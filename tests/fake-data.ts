import {
  addDays,
  DATA_END,
  DATA_START,
  dayKey,
  dayStart,
  INTERVAL,
  SENSORS,
  type DayKey,
  type DayRange,
  type ExportSource,
} from "@/components/export/export-data";
import {
  bridge,
  FIRST_ESL,
  LAST_ESL,
  monthCheck,
  prefixOf,
  type AnalysisData,
  type EslReading,
  type MonthCheck,
} from "@/components/analysis/analysis-data";
import { intersect } from "@/components/analysis/period";
import type { Gap } from "@/lib/timeseries";
import { SENSOR_IDS, type DataPoint, type SensorId } from "@/lib/types";

// made-up readings with the same numbers as the figma frames, only for the tests of the
// analysis and export helpers. the app itself only shows imported data

export const GAPS: DayRange[] = [
  { from: "2020-02-09", to: "2020-02-09" },
  { from: "2020-06-14", to: "2020-06-15" },
  { from: "2021-02-18", to: "2021-02-24" },
  { from: "2021-03-27", to: "2021-03-27" },
];

// in the test data sdat is always 3x the esl difference (confirmed by the client)
export const SDAT_FACTOR = 3;

interface Grid {
  start: number;
  count: number;
  // 1 where the interval lies in a gap day and has no value
  gap: Uint8Array;
}

let grid: Grid | null = null;

function getGrid(): Grid {
  if (grid) return grid;
  const start = dayStart(DATA_START);
  const count = (dayStart(addDays(DATA_END, 1)) - start) / INTERVAL;
  const gap = new Uint8Array(count);
  for (const range of GAPS) {
    const a = (dayStart(range.from) - start) / INTERVAL;
    const b = (dayStart(addDays(range.to, 1)) - start) / INTERVAL;
    gap.fill(1, a, b);
  }
  grid = { start, count, gap };
  return grid;
}

// deterministic noise in [0, 1)
function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// usage per 15 min in arbitrary units, scaled to the meter totals afterwards
function consumptionWeight(i: number, hour: number, dayOfYear: number) {
  const season = 1 + 0.35 * Math.cos((2 * Math.PI * (dayOfYear - 10)) / 365.25);
  const daily =
    0.45 +
    0.55 * Math.exp(-((hour - 7.5) ** 2) / 2) +
    0.2 * Math.exp(-((hour - 12.5) ** 2) / 3) +
    0.8 * Math.exp(-((hour - 19) ** 2) / 4);
  return season * daily * (0.7 + 0.6 * hash(i));
}

function feedInWeight(i: number, hour: number, dayOfYear: number) {
  const summer =
    0.5 + 0.5 * Math.cos((2 * Math.PI * (dayOfYear - 172)) / 365.25);
  const rise = 8 - 2.8 * summer;
  const set = 16.5 + 4.5 * summer;
  if (hour <= rise || hour >= set) return 0;
  const sun = Math.sin((Math.PI * (hour - rise)) / (set - rise));
  const cloud = 0.35 + 0.65 * hash(Math.floor(i / 96) * 7.3 + 1);
  return (0.25 + 0.75 * summer) * cloud * sun * (0.9 + 0.2 * hash(i + 0.5));
}

const METER = {
  [SENSOR_IDS.consumption]: {
    first: 3570.0,
    last: 54435.3,
    weight: consumptionWeight,
  },
  [SENSOR_IDS.feedIn]: { first: 6435.3, last: 23367.0, weight: feedInWeight },
} satisfies Record<SensorId, object>;

const readingsCache = new Map<SensorId, Float64Array>();

// meter reading at the end of every 15 min interval
function getReadings(sensor: SensorId): Float64Array {
  const cached = readingsCache.get(sensor);
  if (cached) return cached;
  const { start, count } = getGrid();
  const { first, last, weight } = METER[sensor];
  const cumulative = new Float64Array(count);
  let sum = 0;
  for (let i = 1; i < count; i++) {
    const ts = start + i * INTERVAL;
    // local hour without dst is close enough for fake data
    const hour = (((ts / 3600 + 1) % 24) + 24) % 24;
    const dayOfYear = Math.floor(i / 96) % 365.25;
    sum += weight(i, hour, dayOfYear);
    cumulative[i] = sum;
  }
  const scale = (last - first) / sum;
  for (let i = 0; i < count; i++) cumulative[i] = first + cumulative[i] * scale;
  readingsCache.set(sensor, cumulative);
  return cumulative;
}

let fakeSource: ExportSource | null = null;

// the made-up readings in the same shape as the real ones, one per 15 min, nothing in the gaps
export function fakeExportSource(): ExportSource {
  if (fakeSource) return fakeSource;
  const { start, count, gap } = getGrid();
  const gaps: Gap[] = GAPS.map((range) => ({
    start: dayStart(range.from),
    end: dayStart(addDays(range.to, 1)),
  }));
  const source = {} as ExportSource;
  for (const { id } of SENSORS) {
    const values = getReadings(id);
    const readings: DataPoint[] = [];
    for (let i = 0; i < count; i++) {
      // a reading belongs to the end of its interval
      if (!gap[i])
        readings.push({ ts: start + (i + 1) * INTERVAL, value: values[i] });
    }
    source[id] = { sensorId: id, readings, gaps };
  }
  fakeSource = source;
  return source;
}

function monthKey(year: number, month: number): DayKey {
  return dayKey(year, month, 1);
}

// one made-up esl reading on the first of every month. after the end of sdat the readings
// grow by the usage of the same month one year earlier
function fakeEsl(
  raw: Float64Array,
  values: Float64Array,
  start: number,
  count: number,
): EslReading[] {
  const lastTs = start + count * INTERVAL;
  const known = new Map<DayKey, number>();
  const valueOn = (day: DayKey): number => {
    const ts = dayStart(day);
    if (ts <= lastTs) return values[(ts - start) / INTERVAL];
    const stored = known.get(day);
    if (stored !== undefined) return stored;
    const [y, m] = day.split("-").map(Number);
    const value =
      valueOn(monthKey(y, m - 2)) +
      valueOn(monthKey(y - 1, m - 1)) -
      valueOn(monthKey(y - 1, m - 2));
    known.set(day, value);
    return value;
  };

  const list: EslReading[] = [];
  const [firstYear, firstMonth] = FIRST_ESL.split("-").map(Number);
  for (let i = 0; ; i++) {
    const day = monthKey(firstYear, firstMonth - 1 + i);
    if (day > LAST_ESL) break;
    const ts = dayStart(day);
    const value = valueOn(day);
    const previous = list[list.length - 1];
    let check: MonthCheck | null = null;
    if (previous) {
      const month = { from: previous.day, to: addDays(day, -1) };
      let sdat: number | null = null;
      if (ts <= lastTs) {
        // the sdat sum leaves out the missing days, the esl difference still counts them
        let gapUsage = 0;
        for (const gap of GAPS.filter((gap) => intersect(gap, month))) {
          const a = (dayStart(gap.from) - start) / INTERVAL;
          const b = (dayStart(addDays(gap.to, 1)) - start) / INTERVAL;
          gapUsage += raw[b - 1] - raw[a - 1];
        }
        sdat = (value - previous.value - gapUsage) * SDAT_FACTOR;
      }
      check = monthCheck(previous, day, value, sdat, GAPS);
    }
    list.push({ day, ts, value, check });
  }
  return list;
}

let fakeData: AnalysisData | null = null;

// the same readings for the analysis, sdat = 3x the meter difference like in the test data
export function fakeAnalysisData(): AnalysisData {
  if (fakeData) return fakeData;
  const { start, count, gap } = getGrid();
  const data: AnalysisData = {
    start,
    count,
    gap,
    usage: {} as AnalysisData["usage"],
    prefix: {} as AnalysisData["prefix"],
    meter: {} as AnalysisData["meter"],
    esl: {} as AnalysisData["esl"],
    gaps: GAPS,
    ratio: SDAT_FACTOR,
  };
  for (const { id: sensor } of SENSORS) {
    const readings = getReadings(sensor);
    const usage = new Float64Array(count);
    for (let i = 1; i < count; i++) {
      if (!gap[i]) usage[i] = (readings[i] - readings[i - 1]) * SDAT_FACTOR;
    }
    // value k = reading at the start of interval k (= end of interval k - 1)
    const meter = new Float64Array(count + 1);
    meter[0] = readings[0];
    for (let k = 1; k <= count; k++) meter[k] = readings[k - 1];
    for (let k = 1; k < count; k++) if (gap[k]) meter[k] = NaN;
    bridge(meter);
    data.usage[sensor] = usage;
    data.prefix[sensor] = prefixOf(usage);
    data.meter[sensor] = meter;
    data.esl[sensor] = fakeEsl(readings, meter, start, count);
  }
  fakeData = data;
  return data;
}
