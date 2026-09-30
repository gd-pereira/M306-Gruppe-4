import {
  addDays,
  DATA_END,
  DATA_START,
  dayKey,
  daysBetween,
  dayStart,
  formatDay,
  formatDayRange,
  GAPS,
  getGrid,
  getReadings,
  INTERVAL,
  type DayKey,
  type DayRange,
} from "@/components/export/fake-export";
import type { SensorId } from "@/lib/types";
import { intersect, MONTH_NAMES, type Resolution, type Scope } from "./period";

// stand-in for the ImportResult (T3-2/T3-11) on the verbrauch and zählerstand pages,
// built from the same fake meter readings as the export so all pages show the same numbers

// in the test data sdat is always 3x the esl difference (confirmed by the client)
export const SDAT_FACTOR = 3;
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

interface DayInfo {
  key: DayKey;
  // interval indices of the grid, a included, b not
  a: number;
  b: number;
  gap: boolean;
}

let dayTable: DayInfo[] | null = null;

function days(): DayInfo[] {
  if (dayTable) return dayTable;
  const { start, gap } = getGrid();
  const count = daysBetween(DATA_START, DATA_END) + 1;
  dayTable = Array.from({ length: count }, (_, index) => {
    const key = addDays(DATA_START, index);
    const a = (dayStart(key) - start) / INTERVAL;
    const b = (dayStart(addDays(key, 1)) - start) / INTERVAL;
    return { key, a, b, gap: gap[a] === 1 };
  });
  return dayTable;
}

function daysIn(range: DayRange): DayInfo[] {
  const inside = intersect(range, USAGE_SCOPE.data);
  if (!inside) return [];
  const table = days();
  const first = daysBetween(DATA_START, inside.from);
  return table.slice(first, first + daysBetween(inside.from, inside.to) + 1);
}

// sdat value of interval i in kWh
function usage(readings: Float64Array, i: number): number {
  return i === 0 ? 0 : (readings[i] - readings[i - 1]) * SDAT_FACTOR;
}

function sum(readings: Float64Array, a: number, b: number): number {
  return (
    (readings[b - 1] - (a === 0 ? readings[0] : readings[a - 1])) * SDAT_FACTOR
  );
}

export interface UsageBucket {
  start: number;
  end: number;
  consumption: number | null;
  feedIn: number | null;
  // days without sdat inside a week or month
  missingDays: number;
}

const CONSUMPTION: SensorId = "ID742";
const FEED_IN: SensorId = "ID735";

function mondayOf(day: DayKey): DayKey {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

// sdat values per bucket of the resolution. gap days stay null so the line breaks there,
// weeks and months only count when the data covers them completely, a cut-off month would look like a drop
export function usageBuckets(
  range: DayRange,
  resolution: Resolution,
): UsageBucket[] {
  const { start } = getGrid();
  const consumption = getReadings(CONSUMPTION);
  const feedIn = getReadings(FEED_IN);
  const list = daysIn(range);
  const buckets: UsageBucket[] = [];

  if (resolution === "15min" || resolution === "hour") {
    const step = resolution === "15min" ? 1 : 4;
    for (const day of list) {
      for (let i = day.a; i < day.b; i += step) {
        const value = (readings: Float64Array) =>
          day.gap
            ? null
            : step === 1
              ? usage(readings, i)
              : sum(readings, i, i + step);
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

export function usageTotals(range: DayRange): UsageTotals {
  const { start } = getGrid();
  const consumption = getReadings(CONSUMPTION);
  const feedIn = getReadings(FEED_IN);
  let c = 0;
  let f = 0;
  let peak: UsageTotals["peak"] = null;
  for (const day of daysIn(range)) {
    if (day.gap) continue;
    c += sum(consumption, day.a, day.b);
    f += sum(feedIn, day.a, day.b);
    for (let i = day.a; i < day.b; i++) {
      const value = usage(consumption, i);
      if (!peak || value > peak.value) {
        peak = { value, ts: start + i * INTERVAL };
      }
    }
  }
  return { consumption: c, feedIn: f, peak };
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
export function usageRegions(range: DayRange): ChartRegion[] {
  const regions: ChartRegion[] = [];
  for (const gap of GAPS) {
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
export function meterRegions(range: DayRange): ChartRegion[] {
  const regions: ChartRegion[] = [];
  const backcalc = clipped(range, DATA_START, addDays(FIRST_ESL, -1));
  if (backcalc) {
    regions.push({
      key: "backcalc",
      ...backcalc,
      fill: false,
      edge: "end",
      label: "Zurückgerechnet",
      sub: `ESL ${formatDay(FIRST_ESL)} · SDAT ÷ ${SDAT_FACTOR.toFixed(2)}`,
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
export const GAP_MONTHS = new Set(GAPS.map((gap) => gap.from.slice(0, 7)));
export const PARTIAL_MONTH = DATA_END.slice(0, 7);

// meter readings on every quarter hour, gap days drawn as a straight line between the readings around them
const displayCache = new Map<SensorId, Float64Array>();

function displayReadings(sensor: SensorId): Float64Array {
  const cached = displayCache.get(sensor);
  if (cached) return cached;
  const { count, gap } = getGrid();
  const readings = getReadings(sensor);
  // value k = reading at the start of interval k (= end of interval k - 1)
  const values = new Float64Array(count + 1);
  values[0] = readings[0];
  for (let k = 1; k <= count; k++) values[k] = readings[k - 1];
  let k = 0;
  while (k < count) {
    if (!gap[k]) {
      k++;
      continue;
    }
    const a = k;
    while (k < count && gap[k]) k++;
    const from = values[a];
    const to = values[k];
    for (let j = a + 1; j < k; j++) {
      values[j] = from + ((to - from) * (j - a)) / (k - a);
    }
  }
  displayCache.set(sensor, values);
  return values;
}

export interface MeterPoint {
  ts: number;
  value: number;
}

// the calculated line up to the end of sdat, one point per 15 min, hour or day
export function meterLine(
  sensor: SensorId,
  range: DayRange,
  resolution: "15min" | "hour" | "day",
): MeterPoint[] {
  const { start, count } = getGrid();
  const values = displayReadings(sensor);
  const list = daysIn(range);
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
export function sdatEndReading(sensor: SensorId): MeterPoint {
  const { start, count } = getGrid();
  return {
    ts: start + count * INTERVAL,
    value: displayReadings(sensor)[count],
  };
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

const eslCache = new Map<SensorId, EslReading[]>();

function monthKey(year: number, month: number): DayKey {
  return dayKey(year, month, 1);
}

// one esl reading on the first of every month. after the end of sdat the fake readings
// grow by the usage of the same month one year earlier
export function eslReadings(sensor: SensorId): EslReading[] {
  const cached = eslCache.get(sensor);
  if (cached) return cached;
  const { start, count } = getGrid();
  const values = displayReadings(sensor);
  const raw = getReadings(sensor);
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
      const missing = GAPS.filter((gap) => intersect(gap, month));
      let sdat: number | null = null;
      if (ts <= lastTs) {
        // the sdat sum leaves out the missing days, the esl difference still counts them
        let gapUsage = 0;
        for (const gap of missing) {
          const a = (dayStart(gap.from) - start) / INTERVAL;
          const b = (dayStart(addDays(gap.to, 1)) - start) / INTERVAL;
          gapUsage += raw[b - 1] - raw[a - 1];
        }
        sdat = (value - previous.value - gapUsage) * SDAT_FACTOR;
      }
      check = {
        month: MONTH_NAMES[Number(previous.day.slice(5, 7)) - 1],
        eslDiff: value - previous.value,
        sdat,
        missing,
      };
    }
    list.push({ day, ts, value, check });
  }
  eslCache.set(sensor, list);
  return list;
}

export function isIncomplete(reading: EslReading): boolean {
  return (reading.check?.missing.length ?? 0) > 0;
}

// esl readings inside the range plus the neighbours outside, so lines run to the edges
export function eslAround(sensor: SensorId, range: DayRange): EslReading[] {
  const from = rangeStart(range);
  const to = rangeEnd(range);
  const list = eslReadings(sensor);
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

export function gapsIn(range: DayRange): DayRange[] {
  return GAPS.flatMap((gap) => {
    const inside = intersect(gap, range);
    return inside ? [inside] : [];
  });
}

export function gapDays(gaps: DayRange[]): number {
  return gaps.reduce(
    (total, gap) => total + daysBetween(gap.from, gap.to) + 1,
    0,
  );
}
