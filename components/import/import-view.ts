import type { FileType } from "@/lib/detect";
import type { ImportResult, FileStatus as ImportStatus } from "@/lib/import";
import { roundKwh } from "@/lib/math";
import { INTERVAL, type Gap } from "@/lib/timeseries";
import type { DataPoint, Direction } from "@/lib/types";

// the ImportResult of lib/data-store in the shapes the file table and the summary show

export type FileKind = FileType;
export type FileStatus = ImportStatus;

export interface FileRow {
  id: number;
  name: string;
  type: FileKind | null;
  sensor: string | null; // null for esl (both sensors) and broken files
  direction: Direction | "both" | null;
  from: number | null; // unix seconds, first value
  status: FileStatus;
  message?: string; // parser message, only for errors
}

export interface TimeSpan {
  start: number;
  end: number;
}

export interface ImportSummary {
  period: TimeSpan | null; // first to last value over sdat and esl
  sdat: (TimeSpan & { gaps: TimeSpan[] }) | null;
  eslReadings: number[]; // one ts per reading
  values: Record<Direction, number>; // 15 min values per sensor
  eslFiles: number;
  duplicates: number;
  replaced: number; // placeholders filled by later files
  gapDays: number;
  kwh: Record<Direction, number>;
  ignoredSensors: string[];
}

export interface ImportView {
  files: FileRow[];
  summary: ImportSummary;
}

const DAY = 24 * 60 * 60;
const DIRECTIONS: Direction[] = ["consumption", "feedIn"];

export function isXml(name: string): boolean {
  return name.toLowerCase().endsWith(".xml");
}

function sortedUnique<T extends string | number>(values: T[]): T[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function first(points: DataPoint[]): number {
  return points.length > 0 ? points[0].ts : Infinity;
}

function last(points: DataPoint[]): number {
  return points.length > 0 ? points[points.length - 1].ts : -Infinity;
}

function span(start: number, end: number): TimeSpan | null {
  return start <= end ? { start, end } : null;
}

// both sensors normally miss the same days, a gap of only one of them still counts
function mergeGaps(gaps: Gap[]): TimeSpan[] {
  const sorted = [...gaps].sort((a, b) => a.start - b.start);
  const merged: TimeSpan[] = [];
  for (const gap of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && gap.start <= previous.end) {
      previous.end = Math.max(previous.end, gap.end);
    } else {
      merged.push({ ...gap });
    }
  }
  return merged;
}

function sum(points: DataPoint[]): number {
  return points.reduce((total, point) => total + point.value, 0);
}

export function fileRows(result: ImportResult): FileRow[] {
  return result.files.map((file, id) => ({
    id,
    name: file.file,
    type: file.type,
    sensor: file.sensorIds.length === 1 ? file.sensorIds[0] : null,
    direction:
      file.directions.length === 2 ? "both" : (file.directions[0] ?? null),
    from: file.from,
    status: file.status,
    message: file.message,
  }));
}

export function importSummary(result: ImportResult): ImportSummary {
  const sdatStart = Math.min(
    ...DIRECTIONS.map((d) => first(result[d].usage["15min"])),
  );
  const sdatEnd = Math.max(
    ...DIRECTIONS.map((d) => last(result[d].usage["15min"])),
  );
  const eslReadings = sortedUnique(
    DIRECTIONS.flatMap((d) => result[d].esl.map((point) => point.ts)),
  );
  const gaps = mergeGaps(DIRECTIONS.flatMap((d) => result[d].gaps));
  const sdat = span(sdatStart, sdatEnd + INTERVAL);

  return {
    period: span(
      Math.min(sdatStart, eslReadings[0] ?? Infinity),
      Math.max(sdatEnd, eslReadings[eslReadings.length - 1] ?? -Infinity),
    ),
    sdat: sdat && { ...sdat, gaps },
    eslReadings,
    values: {
      consumption: result.consumption.valueCount,
      feedIn: result.feedIn.valueCount,
    },
    eslFiles: result.stats.eslFiles,
    duplicates: result.stats.duplicates,
    replaced: result.stats.placeholders,
    gapDays: Math.round(
      gaps.reduce((total, gap) => total + gap.end - gap.start, 0) / DAY,
    ),
    kwh: {
      consumption: roundKwh(sum(result.consumption.usage.month)),
      feedIn: roundKwh(sum(result.feedIn.usage.month)),
    },
    ignoredSensors: sortedUnique(result.ignored.map((file) => file.sensorId)),
  };
}

const views = new WeakMap<ImportResult, ImportView>();

export function importView(result: ImportResult): ImportView {
  let view = views.get(result);
  if (!view) {
    view = { files: fileRows(result), summary: importSummary(result) };
    views.set(result, view);
  }
  return view;
}
