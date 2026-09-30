import {
  buildFile as buildExportFile,
  csvLines,
  exportSummary,
  fileName as exportFileName,
  jsonValue,
  readingsInRange,
  type ExportFormat,
  type ExportRequest,
  type ExportSeries,
} from "@/lib/export";
import { formatNumber } from "@/lib/format";
import { zurichToUnix } from "@/lib/time";
import type { Gap } from "@/lib/timeseries";
import {
  SENSOR_IDS,
  type DataPoint,
  type Direction,
  type SensorId,
} from "@/lib/types";

// the export screen's helpers: days and ranges for the ui, the file itself comes from lib/export.ts
// the values come in as an ExportSource: the real meter readings after an import (export-source.ts),
// before that and for the demo data the made-up curve below with the same numbers as the figma frames
// no store or react imports here, server components use the day helpers too

// "YYYY-MM-DD", a day in swiss local time
export type DayKey = string;
export interface DayRange {
  from: DayKey;
  to: DayKey;
}
export type { ExportFormat };

export const DATA_START: DayKey = "2018-01-01";
export const DATA_END: DayKey = "2021-09-06";
// 2018 is calculated backwards from the first esl reading on 01.01.2019
export const BACKCALC_END: DayKey = "2018-12-31";
export const GAPS: DayRange[] = [
  { from: "2020-02-09", to: "2020-02-09" },
  { from: "2020-06-14", to: "2020-06-15" },
  { from: "2021-02-18", to: "2021-02-24" },
  { from: "2021-03-27", to: "2021-03-27" },
];

export interface SensorInfo {
  id: SensorId;
  direction: Direction;
  label: string;
  hint: string;
}

export const SENSORS: SensorInfo[] = [
  {
    id: SENSOR_IDS.consumption,
    direction: "consumption",
    label: "Bezug",
    hint: "aus dem Netz bezogen",
  },
  {
    id: SENSOR_IDS.feedIn,
    direction: "feedIn",
    label: "Einspeisung",
    hint: "ins Netz eingespeist",
  },
];

export function sensorInfo(id: SensorId): SensorInfo {
  return SENSORS.find((sensor) => sensor.id === id) ?? SENSORS[0];
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: string): boolean {
  const match = DAY_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function dayKey(year: number, month: number, day: number): DayKey {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function addDays(day: DayKey, days: number): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(y, m - 1, d + days);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// unix seconds of 00:00 swiss time on that day
export function dayStart(day: DayKey): number {
  return zurichToUnix(`${day}T00:00:00`);
}

// "en-CA" writes dates as YYYY-MM-DD
const zurichDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// the swiss day of a moment, e.g. 1581202800 -> "2020-02-09"
export function dayOf(ts: number): DayKey {
  return zurichDay.format(new Date(ts * 1000));
}

export function formatDay(day: DayKey): string {
  const [y, m, d] = day.split("-");
  return `${d}.${m}.${y}`;
}

// 14.–15.06.2020 for gaps inside one month, full dates otherwise
export function formatDayRange({ from, to }: DayRange): string {
  if (from === to) return formatDay(from);
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  if (fy === ty && fm === tm) return `${fd}.–${td}.${tm}.${ty}`;
  if (fy === ty) return `${fd}.${fm}.–${td}.${tm}.${ty}`;
  return `${formatDay(from)} – ${formatDay(to)}`;
}

export function isValidRange(range: DayRange): boolean {
  return range.from <= range.to;
}

export interface RangePreset {
  id: string;
  label: string;
  range: DayRange;
}

export const PRESETS: RangePreset[] = [
  { id: "all", label: "Alles", range: { from: DATA_START, to: DATA_END } },
  { id: "2021", label: "2021", range: { from: "2021-01-01", to: DATA_END } },
  {
    id: "2020",
    label: "2020",
    range: { from: "2020-01-01", to: "2020-12-31" },
  },
  {
    id: "2019",
    label: "2019",
    range: { from: "2019-01-01", to: "2019-12-31" },
  },
  { id: "2018", label: "2018", range: { from: DATA_START, to: "2018-12-31" } },
  {
    id: "30d",
    label: "Letzte 30 Tage",
    range: { from: addDays(DATA_END, -29), to: DATA_END },
  },
];

export function presetFor(range: DayRange): RangePreset | undefined {
  return PRESETS.find(
    (preset) =>
      preset.range.from === range.from && preset.range.to === range.to,
  );
}

export const INTERVAL = 900;

export interface Grid {
  start: number;
  count: number;
  // 1 where the interval lies in a gap day and has no value
  gap: Uint8Array;
}

let grid: Grid | null = null;

export function getGrid(): Grid {
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
export function getReadings(sensor: SensorId): Float64Array {
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

// the made-up readings in the same shape as the real ones, one per 15 min, nothing in the gaps
let fakeSource: ExportSource | null = null;

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

// the meter readings of both sensors that the export uses
export type ExportSource = Record<SensorId, ExportSeries>;

export interface ExportSelection {
  format: ExportFormat;
  sensor: SensorId;
  range: DayRange;
}

function selectedSensors(selection: ExportSelection): SensorId[] {
  return selection.format === "csv"
    ? [selection.sensor]
    : SENSORS.map((sensor) => sensor.id);
}

// from 00:00 on the first day to 00:00 after the last day, in unix seconds
function rangeBounds(range: DayRange): { from: number; to: number } {
  return { from: dayStart(range.from), to: dayStart(addDays(range.to, 1)) };
}

function exportRequest(
  selection: ExportSelection,
  source: ExportSource,
): ExportRequest {
  return {
    format: selection.format,
    series: selectedSensors(selection).map((sensor) => source[sensor]),
    ...rangeBounds(selection.range),
  };
}

export function fileName(selection: ExportSelection): string {
  return exportFileName(selection.format, selection.sensor);
}

export interface ExportStats {
  fileName: string;
  sensors: SensorId[];
  // values in the file, all sensors together
  values: number;
  bytes: number;
  // first and last reading of every sensor in the range
  readings: Partial<Record<SensorId, { first: number; last: number } | null>>;
  gaps: DayRange[];
}

export function exportStats(
  selection: ExportSelection,
  source: ExportSource = fakeExportSource(),
): ExportStats {
  const summary = exportSummary(exportRequest(selection, source));
  return {
    fileName: fileName(selection),
    sensors: selectedSensors(selection),
    values: summary.values,
    bytes: summary.bytes,
    readings: summary.readings,
    // a gap ends at 00:00 of the next day, so its last day is one second earlier
    gaps: summary.gaps.map((gap) => ({
      from: dayOf(gap.start),
      to: dayOf(gap.end - 1),
    })),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${formatNumber(bytes / 1_000)} kB`;
  return `${formatNumber(bytes / 1_000_000, 1)} MB`;
}

// the whole file, built in chunks so the page stays responsive
export async function buildFile(
  selection: ExportSelection,
  source: ExportSource = fakeExportSource(),
): Promise<Blob> {
  return buildExportFile(exportRequest(selection, source));
}

export interface Preview {
  lines: string[];
  // lines (csv) or values (json) that are not shown
  remaining: number;
  unit: "Zeilen" | "Werte";
}

export function preview(
  selection: ExportSelection,
  stats: ExportStats,
  rows: number,
  source: ExportSource = fakeExportSource(),
): Preview {
  const request = exportRequest(selection, source);
  if (selection.format === "csv") {
    const lines: string[] = [];
    for (const line of csvLines(request)) {
      if (lines.length === rows) break;
      lines.push(line);
    }
    return {
      lines,
      // plus the two lines "sep=," and the header
      remaining: stats.values + 2 - lines.length,
      unit: "Zeilen",
    };
  }

  // pretty-printed for reading: a few values per sensor with "…" in between, cut off where the card ends
  const perSensor = Math.max(2, Math.floor((rows - 11) / 2));
  const all: { text: string; isValue: boolean }[] = [
    { text: "[", isValue: false },
  ];
  request.series.forEach((series, index) => {
    all.push(
      { text: "  {", isValue: false },
      { text: `    "sensorId": "${series.sensorId}",`, isValue: false },
      { text: `    "data": [`, isValue: false },
    );
    const points = readingsInRange(series.readings, request.from, request.to);
    for (const point of points.slice(0, perSensor)) {
      all.push({ text: `      ${jsonValue(point)},`, isValue: true });
    }
    if (points.length > perSensor)
      all.push({ text: "        …", isValue: false });
    all.push(
      { text: "    ]", isValue: false },
      {
        text: index < request.series.length - 1 ? "  }," : "  }",
        isValue: false,
      },
    );
  });
  all.push({ text: "]", isValue: false });

  const visible = all.slice(0, rows);
  const shownValues = visible.filter((line) => line.isValue).length;
  return {
    lines: visible.map((line) => line.text),
    remaining: stats.values - shownValues,
    unit: "Werte",
  };
}

export interface ChartSeries {
  sensor: SensorId;
  // x as fraction of the range (0..1), y as meter reading
  points: { x: number; y: number }[];
}

export function chartSeries(
  selection: ExportSelection,
  samples = 240,
  source: ExportSource = fakeExportSource(),
): ChartSeries[] {
  const request = exportRequest(selection, source);
  return request.series.map((series) => {
    const points = readingsInRange(series.readings, request.from, request.to);
    const n = Math.min(samples, points.length);
    const sampled: ChartSeries["points"] = [];
    for (let j = 0; j < n; j++) {
      const point =
        points[n === 1 ? 0 : Math.round((j * (points.length - 1)) / (n - 1))];
      sampled.push({
        x: rangeFraction(selection.range, point.ts),
        y: point.value,
      });
    }
    return { sensor: series.sensorId, points: sampled };
  });
}

// position of a moment inside the range as fraction 0..1
export function rangeFraction(range: DayRange, ts: number): number {
  const start = dayStart(range.from);
  const end = dayStart(addDays(range.to, 1));
  return Math.min(1, Math.max(0, (ts - start) / (end - start)));
}

export interface AxisLabel {
  key: string;
  label: string;
  x: number;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

// years for long ranges, months for a few months, single days for short ones
export function axisLabels(range: DayRange): {
  labels: AxisLabel[];
  lines: number[];
} {
  const span = daysBetween(range.from, range.to) + 1;
  const [fromYear, fromMonth] = range.from.split("-").map(Number);
  const [toYear, toMonth] = range.to.split("-").map(Number);
  const end = addDays(range.to, 1);
  const labels: AxisLabel[] = [];
  const lines: number[] = [];
  const segment = (key: string, label: string, from: DayKey, to: DayKey) => {
    const a = rangeFraction(
      range,
      dayStart(from < range.from ? range.from : from),
    );
    const b = rangeFraction(range, dayStart(to > end ? end : to));
    if (from > range.from) lines.push(a);
    if (b - a > 0.05) labels.push({ key, label, x: (a + b) / 2 });
  };

  if (span > 400) {
    for (let year = fromYear; year <= toYear; year++) {
      segment(
        String(year),
        String(year),
        dayKey(year, 0, 1),
        dayKey(year + 1, 0, 1),
      );
    }
  } else if (span > 45) {
    let year = fromYear;
    let month = fromMonth - 1;
    while (year * 12 + month <= toYear * 12 + toMonth - 1) {
      segment(
        `${year}-${month}`,
        MONTHS[month],
        dayKey(year, month, 1),
        dayKey(year, month + 1, 1),
      );
      month++;
      if (month === 12) {
        month = 0;
        year++;
      }
    }
  } else {
    const step = Math.max(1, Math.ceil(span / 6));
    for (let offset = 0; offset < span; offset += step) {
      const day = addDays(range.from, offset);
      const [, m, d] = day.split("-");
      labels.push({
        key: day,
        label: `${d}.${m}.`,
        x: rangeFraction(range, dayStart(day) + 43_200),
      });
    }
  }
  return { labels, lines };
}

// 0, 30’000, 60’000 on a small chart, finer steps when there is room
// the axis starts at 0 unless the values sit far above it, then the line would be flat
export function yTicks(max: number, count: number, min = 0): number[] {
  const from = min <= max - min ? 0 : min;
  const raw = Math.max(max - from, 1) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const r = raw / pow;
  const step =
    (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 3 ? 3 : r <= 5 ? 5 : 10) *
    pow;
  const bottom = Math.floor(from / step) * step;
  const top = Math.max(bottom + step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let tick = bottom; tick <= top + step / 2; tick += step)
    ticks.push(tick);
  return ticks;
}
