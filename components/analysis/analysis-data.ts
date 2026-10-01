import {
  addDays,
  DATA_END,
  DATA_START,
  dayKey,
  dayOf,
  daysBetween,
  dayStart,
  formatDay,
  formatDayRange,
  INTERVAL,
  type DayKey,
  type DayRange,
} from "@/components/export/export-data";
import type { ImportResult } from "@/lib/import";
import type { Comparison } from "@/lib/meter";
import { roundKwh } from "@/lib/math";
import {
  SENSOR_IDS,
  type DataPoint,
  type Direction,
  type SensorId,
} from "@/lib/types";
import { intersect, MONTH_NAMES, type Resolution, type Scope } from "./period";

// the data of the verbrauch and zählerstand pages: sdat usage, meter readings, esl readings
// and gaps on one 15 min grid from DATA_START to DATA_END.
// it comes from the ImportResult (realAnalysisData), before the first import it is empty
// (emptyAnalysisData). every function takes the data as its last parameter, the pages get it from useAnalysisData (analysis-source.ts).
// no store or react imports here, the pages (server components) read the scopes

export const FIRST_ESL: DayKey = "2019-01-01";
export const LAST_ESL: DayKey = "2022-09-01";
// first day without sdat values
export const SDAT_END: DayKey = addDays(DATA_END, 1);

export const USAGE_SCOPE: Scope = {
  data: { from: DATA_START, to: DATA_END },
  all: { from: DATA_START, to: DATA_END },
};
export const METER_SCOPE: Scope = {
  data: { from: DATA_START, to: LAST_ESL },
  all: { from: DATA_START, to: "2022-12-31" },
};

export function rangeStart(range: DayRange): number {
  return dayStart(range.from);
}
export function rangeEnd(range: DayRange): number {
  return dayStart(addDays(range.to, 1));
}

export interface MonthCheck {
  // «Februar»
  month: string;
  eslDiff: number;
  // null after the end of sdat
  sdat: number | null;
  missing: DayRange[];
}

export interface EslReading {
  day: DayKey;
  ts: number;
  value: number;
  // comparison with the reading before, null for the first one
  check: MonthCheck | null;
}

export interface AnalysisData {
  // ts of the first interval and number of 15 min intervals up to the end of DATA_END
  start: number;
  count: number;
  // 1 where the interval has no sdat value
  gap: Uint8Array;
  // sdat value of every interval in kWh, 0 in the gaps
  usage: Record<SensorId, Float64Array>;
  // prefix[i] = sum of the first i values, the sum of a..b is prefix[b] - prefix[a]
  prefix: Record<SensorId, Float64Array>;
  // meter reading at the start of every interval (count + 1 values),
  // gaps are drawn as a straight line between the readings around them
  meter: Record<SensorId, Float64Array>;
  esl: Record<SensorId, EslReading[]>;
  // the gaps as whole days
  gaps: DayRange[];
  // sdat ÷ esl, used to calculate 2018 backwards (3.00 in the test data)
  ratio: number;
}

const DIRECTIONS: Direction[] = ["consumption", "feedIn"];

export function prefixOf(usage: Float64Array): Float64Array {
  const prefix = new Float64Array(usage.length + 1);
  for (let i = 0; i < usage.length; i++) prefix[i + 1] = prefix[i] + usage[i];
  return prefix;
}

// replaces every NaN with a straight line between the known values around it
export function bridge(values: Float64Array): void {
  let k = 0;
  while (k < values.length) {
    if (!Number.isNaN(values[k])) {
      k++;
      continue;
    }
    const a = k - 1;
    while (k < values.length && Number.isNaN(values[k])) k++;
    const from = a >= 0 ? values[a] : values[k];
    const to = k < values.length ? values[k] : from;
    for (let j = a + 1; j < k; j++) {
      values[j] = from + ((to - from) * (j - a)) / (k - a);
    }
  }
}

export function monthCheck(
  previous: { day: DayKey; value: number },
  day: DayKey,
  value: number,
  sdat: number | null,
  gaps: DayRange[],
): MonthCheck {
  const month = { from: previous.day, to: addDays(day, -1) };
  return {
    month: MONTH_NAMES[Number(previous.day.slice(5, 7)) - 1],
    eslDiff: value - previous.value,
    sdat,
    missing: gaps.filter((gap) => intersect(gap, month)),
  };
}

// the real esl readings with the sdat sum of the month before from the comparisons
function realEsl(
  points: DataPoint[],
  comparisons: Comparison[],
  gaps: DayRange[],
): EslReading[] {
  const sdatOf = new Map(
    comparisons.map((c) => [`${c.start}_${c.end}`, c.sdat]),
  );
  const list: EslReading[] = [];
  for (const point of points) {
    const day = dayOf(point.ts);
    const previous = list[list.length - 1];
    let check: MonthCheck | null = null;
    if (previous) {
      check = monthCheck(
        previous,
        day,
        point.value,
        sdatOf.get(`${previous.ts}_${point.ts}`) ?? null,
        gaps,
      );
      check.eslDiff = roundKwh(check.eslDiff);
    }
    list.push({ day, ts: point.ts, value: point.value, check });
  }
  return list;
}

function gridStart(): { start: number; count: number } {
  const start = dayStart(DATA_START);
  return { start, count: (dayStart(addDays(DATA_END, 1)) - start) / INTERVAL };
}

let empty: AnalysisData | null = null;

// the grid without any value, every interval counts as gap
export function emptyAnalysisData(): AnalysisData {
  if (empty) return empty;
  const { start, count } = gridStart();
  const data: AnalysisData = {
    start,
    count,
    gap: new Uint8Array(count).fill(1),
    usage: {} as AnalysisData["usage"],
    prefix: {} as AnalysisData["prefix"],
    meter: {} as AnalysisData["meter"],
    esl: {} as AnalysisData["esl"],
    gaps: [],
    ratio: 1,
  };
  for (const direction of DIRECTIONS) {
    const sensor = SENSOR_IDS[direction];
    data.usage[sensor] = new Float64Array(count);
    data.prefix[sensor] = new Float64Array(count + 1);
    data.meter[sensor] = new Float64Array(count + 1);
    data.esl[sensor] = [];
  }
  empty = data;
  return data;
}

const realCache = new WeakMap<ImportResult, AnalysisData>();

// the imported data on the same grid, values outside DATA_START..DATA_END are left out
export function realAnalysisData(result: ImportResult): AnalysisData {
  const cached = realCache.get(result);
  if (cached) return cached;
  const { start, count } = gridStart();
  const indexOf = (ts: number) => {
    const i = (ts - start) / INTERVAL;
    return Number.isInteger(i) && i >= 0 && i < count ? i : -1;
  };

  // an interval only counts when both sensors have a value there
  const seen = new Uint8Array(count);
  const usage = {} as AnalysisData["usage"];
  for (const direction of DIRECTIONS) {
    const values = new Float64Array(count);
    for (const point of result[direction].usage["15min"]) {
      const i = indexOf(point.ts);
      if (i === -1) continue;
      values[i] = point.value;
      seen[i]++;
    }
    usage[SENSOR_IDS[direction]] = values;
  }
  const gap = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (seen[i] < DIRECTIONS.length) gap[i] = 1;
  }

  // both sensors have the same gaps, a gap ends at 00:00 of the day after
  const gaps = result.consumption.gaps.flatMap((range) => {
    const inside = intersect(
      { from: dayOf(range.start), to: dayOf(range.end - 1) },
      USAGE_SCOPE.data,
    );
    return inside ? [inside] : [];
  });

  const data: AnalysisData = {
    start,
    count,
    gap,
    usage,
    prefix: {} as AnalysisData["prefix"],
    meter: {} as AnalysisData["meter"],
    esl: {} as AnalysisData["esl"],
    gaps,
    ratio: result.consumption.meterRatio,
  };

  for (const direction of DIRECTIONS) {
    const sensor = SENSOR_IDS[direction];
    const own = result[direction];
    data.prefix[sensor] = prefixOf(usage[sensor]);

    // meterReading["15min"] has the start of the interval as ts and the reading at its end
    const meter = new Float64Array(count + 1).fill(NaN);
    for (const point of own.meterReading["15min"]) {
      const i = indexOf(point.ts);
      if (i !== -1) meter[i + 1] = point.value;
    }
    // the reading before the first interval is one sdat value lower (sdat ÷ ratio like 2018)
    if (!Number.isNaN(meter[1])) {
      meter[0] = meter[1] - usage[sensor][0] / own.meterRatio;
    }
    bridge(meter);
    data.meter[sensor] = meter;
    data.esl[sensor] = realEsl(own.esl, own.comparisons, gaps);
  }
  realCache.set(result, data);
  return data;
}

interface DayInfo {
  key: DayKey;
  // interval indices of the grid, a included, b not
  a: number;
  b: number;
  gap: boolean;
}

const dayTables = new WeakMap<AnalysisData, DayInfo[]>();

// a day with a missing value counts as gap day, it is left out instead of shown too low
function days(data: AnalysisData): DayInfo[] {
  const cached = dayTables.get(data);
  if (cached) return cached;
  const { start, gap } = data;
  const count = daysBetween(DATA_START, DATA_END) + 1;
  const table = Array.from({ length: count }, (_, index) => {
    const key = addDays(DATA_START, index);
    const a = (dayStart(key) - start) / INTERVAL;
    const b = (dayStart(addDays(key, 1)) - start) / INTERVAL;
    return { key, a, b, gap: gap.subarray(a, b).includes(1) };
  });
  dayTables.set(data, table);
  return table;
}

function daysIn(range: DayRange, data: AnalysisData): DayInfo[] {
  const inside = intersect(range, USAGE_SCOPE.data);
  if (!inside) return [];
  const table = days(data);
  const first = daysBetween(DATA_START, inside.from);
  return table.slice(first, first + daysBetween(inside.from, inside.to) + 1);
}

// sum of the sdat values of the intervals a (included) to b (not included)
function sum(prefix: Float64Array, a: number, b: number): number {
  return prefix[b] - prefix[a];
}

export interface UsageBucket {
  start: number;
  end: number;
  consumption: number | null;
  feedIn: number | null;
  // days without sdat inside a week or month
  missingDays: number;
}

const CONSUMPTION: SensorId = SENSOR_IDS.consumption;
const FEED_IN: SensorId = SENSOR_IDS.feedIn;

function mondayOf(day: DayKey): DayKey {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

// sdat values per bucket of the resolution. gap days stay null so the line breaks there,
// weeks and months only count when the data covers them completely, a cut-off month would look like a drop
export function usageBuckets(
  range: DayRange,
  resolution: Resolution,
  data: AnalysisData,
): UsageBucket[] {
  const { start } = data;
  const consumption = data.prefix[CONSUMPTION];
  const feedIn = data.prefix[FEED_IN];
  const list = daysIn(range, data);
  const buckets: UsageBucket[] = [];

  if (resolution === "15min" || resolution === "hour") {
    const step = resolution === "15min" ? 1 : 4;
    for (const day of list) {
      for (let i = day.a; i < day.b; i += step) {
        const value = (prefix: Float64Array) =>
          day.gap ? null : sum(prefix, i, i + step);
        buckets.push({
          start: start + i * INTERVAL,
          end: start + (i + step) * INTERVAL,
          consumption: value(consumption),
          feedIn: value(feedIn),
          missingDays: 0,
        });
      }
    }
    return buckets;
  }

  if (resolution === "day") {
    for (const day of list) {
      buckets.push({
        start: start + day.a * INTERVAL,
        end: start + day.b * INTERVAL,
        consumption: day.gap ? null : sum(consumption, day.a, day.b),
        feedIn: day.gap ? null : sum(feedIn, day.a, day.b),
        missingDays: day.gap ? 1 : 0,
      });
    }
    return buckets;
  }

  const inside = intersect(range, USAGE_SCOPE.data);
  if (!inside) return buckets;
  const groups = new Map<DayKey, DayInfo[]>();
  for (const day of list) {
    const key =
      resolution === "week" ? mondayOf(day.key) : `${day.key.slice(0, 7)}-01`;
    const group = groups.get(key);
    if (group) group.push(day);
    else groups.set(key, [day]);
  }
  for (const [first, group] of groups) {
    const [y, m] = first.split("-").map(Number);
    const last = resolution === "week" ? addDays(first, 6) : dayKey(y, m, 0);
    if (first < inside.from || last > inside.to) continue;
    let c = 0;
    let f = 0;
    let missing = 0;
    for (const day of group) {
      if (day.gap) {
        missing++;
        continue;
      }
      c += sum(consumption, day.a, day.b);
      f += sum(feedIn, day.a, day.b);
    }
    const empty = missing === group.length;
    buckets.push({
      start: start + group[0].a * INTERVAL,
      end: start + group[group.length - 1].b * INTERVAL,
      consumption: empty ? null : c,
      feedIn: empty ? null : f,
      missingDays: missing,
    });
  }
  return buckets;
}

export interface UsageTotals {
  consumption: number;
  feedIn: number;
  // highest 15 min value of the consumption
  peak: { value: number; ts: number } | null;
}

export function usageTotals(range: DayRange, data: AnalysisData): UsageTotals {
  const { start } = data;
  const consumption = data.prefix[CONSUMPTION];
  const feedIn = data.prefix[FEED_IN];
  const values = data.usage[CONSUMPTION];
  let c = 0;
  let f = 0;
  let peak: UsageTotals["peak"] = null;
  for (const day of daysIn(range, data)) {
    if (day.gap) continue;
    c += sum(consumption, day.a, day.b);
    f += sum(feedIn, day.a, day.b);
    for (let i = day.a; i < day.b; i++) {
      const value = values[i];
      if (!peak || value > peak.value) {
        peak = { value, ts: start + i * INTERVAL };
      }
    }
  }
  return { consumption: c, feedIn: f, peak };
}

export interface YearTotals {
  year: number;
  range: DayRange;
  consumption: number;
  feedIn: number;
  // the last year stops with the data
  partial: boolean;
}

export function yearTotals(data: AnalysisData): YearTotals[] {
  const { from, to } = USAGE_SCOPE.data;
  const years: YearTotals[] = [];
  for (
    let year = Number(from.slice(0, 4));
    year <= Number(to.slice(0, 4));
    year++
  ) {
    const range = intersect(
      { from: `${year}-01-01`, to: `${year}-12-31` },
      USAGE_SCOPE.data,
    )!;
    const { consumption, feedIn } = usageTotals(range, data);
    years.push({
      year,
      range,
      consumption,
      feedIn,
      partial: range.to !== `${year}-12-31`,
    });
  }
  return years;
}

// 15 min values per sensor, gap days have none
export function valueCount(data: AnalysisData): number {
  const { count, gap } = data;
  let missing = 0;
  for (let i = 0; i < count; i++) missing += gap[i];
  return count - missing;
}

export interface ChartRegion {
  key: string;
  from: number;
  to: number;
  // grey background, otherwise only a dashed line on the inner edge
  fill: boolean;
  // which edge gets the dashed line
  edge: "start" | "end";
  label: string;
  sub?: string;
  // top or bottom keeps the label off the line
  placement: "center" | "top" | "bottom";
}

function clipped(range: DayRange, from: DayKey, to: DayKey) {
  const inside = intersect(range, { from, to });
  return inside ? { from: rangeStart(inside), to: rangeEnd(inside) } : null;
}

// the parts of the range without sdat: the gap days and everything after 06.09.2021
export function usageRegions(
  range: DayRange,
  data: AnalysisData,
): ChartRegion[] {
  const regions: ChartRegion[] = [];
  for (const gap of data.gaps) {
    const area = clipped(range, gap.from, gap.to);
    if (!area) continue;
    regions.push({
      key: gap.from,
      ...area,
      fill: true,
      edge: "start",
      label: "Keine SDAT-Daten",
      sub: formatDayRange(gap),
      placement: "center",
    });
  }
  const end = clipped(range, SDAT_END, "9999-12-31");
  if (end) {
    regions.push({
      key: "end",
      ...end,
      fill: true,
      edge: "start",
      label: "Keine SDAT-Daten ab 07.09.2021",
      sub: "Für diesen Zeitraum gibt es nur ESL-Zählerstände (siehe Zählerstand).",
      placement: "center",
    });
  }
  return regions;
}

// 2018 is calculated backwards from the first esl reading, after sdat only the esl readings are left
export function meterRegions(
  range: DayRange,
  data: AnalysisData,
): ChartRegion[] {
  const regions: ChartRegion[] = [];
  const backcalc = clipped(range, DATA_START, addDays(FIRST_ESL, -1));
  if (backcalc) {
    regions.push({
      key: "backcalc",
      ...backcalc,
      fill: false,
      edge: "end",
      label: "Zurückgerechnet",
      sub: `ESL ${formatDay(FIRST_ESL)} · SDAT ÷ ${data.ratio.toFixed(2)}`,
      placement: "top",
    });
  }
  const end = clipped(range, SDAT_END, "9999-12-31");
  if (end) {
    regions.push({
      key: "end",
      ...end,
      fill: true,
      edge: "start",
      label: "Keine SDAT-Daten",
      sub: `ab ${formatDay(SDAT_END)} · nur ESL-Ablesungen`,
      placement: "bottom",
    });
  }
  return regions;
}

// months with sdat gaps and the month where sdat ends, for the red and grey dots in the picker
export function gapMonths(data: AnalysisData): Set<string> {
  return new Set(
    data.gaps.flatMap((gap) => [gap.from.slice(0, 7), gap.to.slice(0, 7)]),
  );
}
export const PARTIAL_MONTH = DATA_END.slice(0, 7);

export interface MeterPoint {
  ts: number;
  value: number;
}

// the calculated line up to the end of sdat, one point per 15 min, hour or day
export function meterLine(
  sensor: SensorId,
  range: DayRange,
  resolution: "15min" | "hour" | "day",
  data: AnalysisData,
): MeterPoint[] {
  const { start, count } = data;
  const values = data.meter[sensor];
  const list = daysIn(range, data);
  if (list.length === 0) return [];
  const step = resolution === "15min" ? 1 : resolution === "hour" ? 4 : 0;
  const points: MeterPoint[] = [];
  for (const day of list) {
    if (step === 0) {
      points.push({ ts: start + day.a * INTERVAL, value: values[day.a] });
      continue;
    }
    for (let k = day.a; k < day.b; k += step) {
      points.push({ ts: start + k * INTERVAL, value: values[k] });
    }
  }
  const end = Math.min(list[list.length - 1].b, count);
  points.push({ ts: start + end * INTERVAL, value: values[end] });
  return points;
}

// last calculated reading, where the dashed esl line starts
export function sdatEndReading(
  sensor: SensorId,
  data: AnalysisData,
): MeterPoint {
  const { start, count } = data;
  return { ts: start + count * INTERVAL, value: data.meter[sensor][count] };
}

// one esl reading on the first of every month
export function eslReadings(
  sensor: SensorId,
  data: AnalysisData,
): EslReading[] {
  return data.esl[sensor];
}

export function isIncomplete(reading: EslReading): boolean {
  return (reading.check?.missing.length ?? 0) > 0;
}

// esl readings inside the range plus the neighbours outside, so lines run to the edges
export function eslAround(
  sensor: SensorId,
  range: DayRange,
  data: AnalysisData,
): EslReading[] {
  const from = rangeStart(range);
  const to = rangeEnd(range);
  const list = eslReadings(sensor, data);
  const first = list.findIndex((reading) => reading.ts >= from);
  const last = list.findLastIndex((reading) => reading.ts <= to);
  if (first === -1) return list.slice(-1);
  if (last === -1) return list.slice(0, 1);
  return list.slice(Math.max(0, first - 1), last + 2);
}

// where the zählerstand in the range comes from
export type SourceKind = "backcalc" | "measured" | "eslOnly" | "none";

export interface SourceSegment {
  kind: SourceKind;
  range: DayRange;
}

export function sourceSegments(range: DayRange): SourceSegment[] {
  const parts: SourceSegment[] = [
    {
      kind: "backcalc",
      range: { from: DATA_START, to: addDays(FIRST_ESL, -1) },
    },
    { kind: "measured", range: { from: FIRST_ESL, to: DATA_END } },
    { kind: "eslOnly", range: { from: SDAT_END, to: LAST_ESL } },
    { kind: "none", range: { from: addDays(LAST_ESL, 1), to: "9999-12-31" } },
  ];
  return parts.flatMap((part) => {
    const inside = intersect(part.range, range);
    return inside ? [{ kind: part.kind, range: inside }] : [];
  });
}

export function gapsIn(range: DayRange, data: AnalysisData): DayRange[] {
  return data.gaps.flatMap((gap) => {
    const inside = intersect(gap, range);
    return inside ? [inside] : [];
  });
}

function monthOf(day: DayKey): DayRange {
  const [y, m] = day.split("-").map(Number);
  return { from: dayKey(y, m - 1, 1), to: dayKey(y, m, 0) };
}

// red marks under the zählerstand chart and in the sources bar, both need the same x
// over several years whole months are marked, single days would be too thin
export function gapMarks(range: DayRange, data: AnalysisData): DayRange[] {
  const gaps = gapsIn(range, data);
  if (daysBetween(range.from, range.to) <= 400) return gaps;
  return [...new Set(gaps.map((gap) => gap.from.slice(0, 7)))].flatMap(
    (month) => {
      const inside = intersect(monthOf(`${month}-01`), range);
      return inside ? [inside] : [];
    },
  );
}

export function gapDays(gaps: DayRange[]): number {
  return gaps.reduce(
    (total, gap) => total + daysBetween(gap.from, gap.to) + 1,
    0,
  );
}
