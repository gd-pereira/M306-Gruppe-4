import { formatNumber } from "@/lib/format";
import { zurichToUnix } from "@/lib/time";
import { SENSOR_IDS, type Direction, type SensorId } from "@/lib/types";

// stand-in for export.ts (T4-1): same numbers as the figma frames, the real meter readings replace it later

// "YYYY-MM-DD", a day in swiss local time
export type DayKey = string;
export interface DayRange {
  from: DayKey;
  to: DayKey;
}
export type ExportFormat = "csv" | "json";

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

const INTERVAL = 900;

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

function indexRange(range: DayRange): [number, number] {
  const { start, count } = getGrid();
  const a = (dayStart(range.from) - start) / INTERVAL;
  const b = (dayStart(addDays(range.to, 1)) - start) / INTERVAL;
  return [Math.max(0, Math.min(count, a)), Math.max(0, Math.min(count, b))];
}

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

export function fileName(selection: ExportSelection): string {
  return selection.format === "csv"
    ? `${selection.sensor}.csv`
    : "zaehlerstaende.json";
}

export function mimeType(format: ExportFormat): string {
  return format === "csv" ? "text/csv;charset=utf-8" : "application/json";
}

const value = (reading: number) => reading.toFixed(1);
const csvLine = (ts: number, reading: number) => `${ts},${value(reading)}`;
const jsonValue = (ts: number, reading: number) =>
  `{"ts":"${ts}","value":${value(reading)}}`;
const jsonHead = (sensor: SensorId) => `{"sensorId":"${sensor}","data":[`;

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

export function exportStats(selection: ExportSelection): ExportStats {
  const { start, gap } = getGrid();
  const [a, b] = indexRange(selection.range);
  const sensors = selectedSensors(selection);
  const readings: ExportStats["readings"] = {};
  let values = 0;
  let bytes =
    selection.format === "csv" ? "timestamp,value\n".length : "[]\n".length;

  sensors.forEach((sensor, index) => {
    const series = getReadings(sensor);
    let first: number | null = null;
    let last: number | null = null;
    let count = 0;
    for (let i = a; i < b; i++) {
      if (gap[i]) continue;
      const reading = series[i];
      first ??= reading;
      last = reading;
      count++;
      const ts = start + (i + 1) * INTERVAL;
      // csv: line plus newline, json: value plus separating comma (one too many, taken off below)
      bytes +=
        (selection.format === "csv"
          ? csvLine(ts, reading).length
          : jsonValue(ts, reading).length) + 1;
    }
    values += count;
    readings[sensor] = first === null || last === null ? null : { first, last };
    if (selection.format === "json") {
      bytes +=
        (index > 0 ? 1 : 0) +
        jsonHead(sensor).length +
        "]}".length -
        (count > 0 ? 1 : 0);
    }
  });

  const gaps = GAPS.filter(
    (g) => g.to >= selection.range.from && g.from <= selection.range.to,
  ).map((g) => ({
    from: g.from < selection.range.from ? selection.range.from : g.from,
    to: g.to > selection.range.to ? selection.range.to : g.to,
  }));

  return {
    fileName: fileName(selection),
    sensors,
    values,
    bytes,
    readings,
    gaps,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${formatNumber(bytes / 1_000)} kB`;
  return `${formatNumber(bytes / 1_000_000, 1)} MB`;
}

function* csvLines(selection: ExportSelection): Generator<string> {
  const { start, gap } = getGrid();
  const [a, b] = indexRange(selection.range);
  yield "timestamp,value";
  const series = getReadings(selection.sensor);
  for (let i = a; i < b; i++) {
    if (!gap[i]) yield csvLine(start + (i + 1) * INTERVAL, series[i]);
  }
}

// csv line by line, json minified in one line
function* filePieces(selection: ExportSelection): Generator<string> {
  if (selection.format === "csv") {
    for (const line of csvLines(selection)) yield `${line}\n`;
    return;
  }
  const { start, gap } = getGrid();
  const [a, b] = indexRange(selection.range);
  yield "[";
  for (const [index, sensor] of selectedSensors(selection).entries()) {
    const series = getReadings(sensor);
    yield `${index > 0 ? "," : ""}${jsonHead(sensor)}`;
    let first = true;
    for (let i = a; i < b; i++) {
      if (gap[i]) continue;
      yield `${first ? "" : ","}${jsonValue(start + (i + 1) * INTERVAL, series[i])}`;
      first = false;
    }
    yield "]}";
  }
  yield "]\n";
}

// the whole file in chunks, yielding to the browser in between so the page stays responsive
export async function buildFile(selection: ExportSelection): Promise<Blob> {
  const parts: string[] = [];
  let chunk: string[] = [];
  for (const piece of filePieces(selection)) {
    chunk.push(piece);
    if (chunk.length === 20_000) {
      parts.push(chunk.join(""));
      chunk = [];
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (chunk.length > 0) parts.push(chunk.join(""));
  return new Blob(parts, { type: mimeType(selection.format) });
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
): Preview {
  if (selection.format === "csv") {
    const lines: string[] = [];
    for (const line of csvLines(selection)) {
      if (lines.length === rows) break;
      lines.push(line);
    }
    return {
      lines,
      remaining: stats.values + 1 - lines.length,
      unit: "Zeilen",
    };
  }

  // pretty-printed for reading: a few values per sensor with "…" in between, cut off where the card ends
  const perSensor = Math.max(2, Math.floor((rows - 11) / 2));
  const { start, gap } = getGrid();
  const [a, b] = indexRange(selection.range);
  const all: { text: string; isValue: boolean }[] = [
    { text: "[", isValue: false },
  ];
  stats.sensors.forEach((sensor, index) => {
    const series = getReadings(sensor);
    all.push(
      { text: "  {", isValue: false },
      { text: `    "sensorId": "${sensor}",`, isValue: false },
      { text: `    "data": [`, isValue: false },
    );
    let shown = 0;
    let more = false;
    for (let i = a; i < b; i++) {
      if (gap[i]) continue;
      if (shown === perSensor) {
        more = true;
        break;
      }
      all.push({
        text: `      ${jsonValue(start + (i + 1) * INTERVAL, series[i])},`,
        isValue: true,
      });
      shown++;
    }
    if (more) all.push({ text: "        …", isValue: false });
    all.push(
      { text: "    ]", isValue: false },
      {
        text: index < stats.sensors.length - 1 ? "  }," : "  }",
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
): ChartSeries[] {
  const [a, b] = indexRange(selection.range);
  const span = b - a;
  return selectedSensors(selection).map((sensor) => {
    const series = getReadings(sensor);
    const points: ChartSeries["points"] = [];
    if (span <= 0) return { sensor, points };
    const n = Math.min(samples, span);
    for (let j = 0; j < n; j++) {
      const offset = n === 1 ? 0 : Math.round((j * (span - 1)) / (n - 1));
      points.push({ x: (offset + 1) / span, y: series[a + offset] });
    }
    return { sensor, points };
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
