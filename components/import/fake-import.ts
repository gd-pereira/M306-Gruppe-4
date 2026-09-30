import { SENSOR_IDS, type Direction } from "@/lib/types";

// stand-in for the real import (lib/data-store.ts) while the import page is frontend only
// everything is guessed from the file names, no file is opened
// the shapes follow what the real ImportResult can give, so swapping it in later is easy

export type FileKind = "sdat" | "esl";
export type FileStatus = "imported" | "ignored" | "error";

export interface FileInfo {
  name: string;
  size: number;
}

export interface FileRow {
  id: number;
  name: string;
  type: FileKind | null;
  sensor: string | null; // null for esl (both sensors) and broken files
  direction: Direction | "both" | null;
  from: number | null; // unix seconds, first day with data
  status: FileStatus;
  message?: string; // parser message, only for errors
}

export interface TimeSpan {
  start: number;
  end: number;
}

export interface ImportSummary {
  period: TimeSpan | null; // first to last day over sdat and esl
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

export interface FakeImportResult {
  files: FileRow[];
  summary: ImportSummary;
}

const DAY = 24 * 60 * 60;
const VALUES_PER_DAY = 96;
// average kWh per 15 min value in the real data, only for the sidebar balance
const KWH_PER_VALUE: Record<Direction, number> = {
  consumption: 0.397,
  feedIn: 0.132,
};
const IGNORED_SENSORS = ["ID26256", "ID26257", "ID26263"];

export function isXml(name: string): boolean {
  return name.toLowerCase().endsWith(".xml");
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function dayTs(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / 1000;
}

function dateInName(name: string): number | null {
  const full = /(\d{4})(\d{2})(\d{2})/.exec(name);
  if (full) {
    return dayTs(Number(full[1]), Number(full[2]), Number(full[3]));
  }
  const month = /(\d{4})-(\d{2})/.exec(name);
  return month ? dayTs(Number(month[1]), Number(month[2]), 1) : null;
}

function kindOf(name: string): FileKind | null {
  if (/^EdmRegisterWertExport/i.test(name) || /^esl[-_]/i.test(name)) {
    return "esl";
  }
  if (/^\d{8}_/.test(name) || /^sdat[-_]/i.test(name)) {
    return "sdat";
  }
  return null;
}

// the real sensor is inside the file, here it comes from the name:
// test files carry it (sdat-ID742.xml), the real ones alternate between the two meters,
// and everything from 2022 on belongs to sensors we ignore
function sensorOf(name: string, from: number | null): string {
  const explicit = /ID\d+/.exec(name);
  if (explicit) {
    return explicit[0];
  }
  const counter = Number(/ESLEVU(\d+)/.exec(name)?.[1] ?? hash(name));
  if (from !== null && from >= dayTs(2022, 1, 1)) {
    return hash(name) % 53 === 0
      ? IGNORED_SENSORS[2]
      : IGNORED_SENSORS[counter % 2];
  }
  return counter % 2 === 0 ? SENSOR_IDS.consumption : SENSOR_IDS.feedIn;
}

function directionOf(sensor: string): Direction | null {
  if (sensor === SENSOR_IDS.consumption) return "consumption";
  if (sensor === SENSOR_IDS.feedIn) return "feedIn";
  return null;
}

export function fakeRow(file: FileInfo, id: number): FileRow {
  const { name } = file;
  const type = kindOf(name);

  if (file.size === 0 || /broken/i.test(name)) {
    return {
      id,
      name,
      type,
      sensor: null,
      direction: null,
      from: null,
      status: "error",
      message:
        file.size === 0 ? "Empty file" : "Invalid XML: Unclosed tag (line 812)",
    };
  }
  if (type === null) {
    return {
      id,
      name,
      type,
      sensor: null,
      direction: null,
      from: null,
      status: "error",
      message: "Not an SDAT file",
    };
  }

  const date = dateInName(name);
  if (type === "esl") {
    return {
      id,
      name,
      type,
      sensor: null,
      direction: "both",
      from: date,
      status: "imported",
    };
  }

  // sdat files are written the morning after the day they contain
  const from = date === null ? null : date - DAY;
  const sensor = sensorOf(name, from);
  const direction = directionOf(sensor);
  return {
    id,
    name,
    type,
    sensor,
    direction,
    from,
    status: direction ? "imported" : "ignored",
  };
}

// missing days between the first and last sdat day, merged into periods
function findGaps(days: number[]): TimeSpan[] {
  const gaps: TimeSpan[] = [];
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] > DAY) {
      gaps.push({ start: days[i - 1] + DAY, end: days[i] });
    }
  }
  return gaps;
}

function sortedUnique(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

export function summarize(files: FileRow[]): ImportSummary {
  const imported = files.filter((f) => f.status === "imported" && f.from);
  const sdat = imported.filter((f) => f.type === "sdat");
  const esl = imported.filter((f) => f.type === "esl");

  const values = { consumption: 0, feedIn: 0 };
  let duplicates = 0;
  let replaced = 0;
  for (const direction of ["consumption", "feedIn"] as const) {
    const days = sdat
      .filter((f) => f.direction === direction)
      .map((f) => f.from!);
    const unique = new Set(days);
    values[direction] = unique.size * VALUES_PER_DAY;
    duplicates += (days.length - unique.size) * VALUES_PER_DAY;
    replaced += Math.round(unique.size * 0.9) * 12;
  }

  const sdatDays = sortedUnique(sdat.map((f) => f.from!));
  const gaps = findGaps(sdatDays);
  const eslReadings = sortedUnique(esl.map((f) => f.from!));
  const allDays = sortedUnique(imported.map((f) => f.from!));

  return {
    period:
      allDays.length > 0
        ? { start: allDays[0], end: allDays[allDays.length - 1] }
        : null,
    sdat:
      sdatDays.length > 0
        ? {
            start: sdatDays[0],
            end: sdatDays[sdatDays.length - 1] + DAY,
            gaps,
          }
        : null,
    eslReadings,
    values,
    eslFiles: files.filter((f) => f.type === "esl" && f.status !== "error")
      .length,
    duplicates,
    replaced,
    gapDays: Math.round(
      gaps.reduce((sum, gap) => sum + gap.end - gap.start, 0) / DAY,
    ),
    kwh: {
      consumption: Math.round(values.consumption * KWH_PER_VALUE.consumption),
      feedIn: Math.round(values.feedIn * KWH_PER_VALUE.feedIn),
    },
    ignoredSensors: sortedUniqueStrings(
      files.filter((f) => f.status === "ignored").map((f) => f.sensor!),
    ),
  };
}

function sortedUniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function buildFakeResult(files: FileInfo[]): FakeImportResult {
  const rows = files.map(fakeRow);
  return { files: rows, summary: summarize(rows) };
}

// small sample for "Demo-Daten laden": january 2021 for both meters with a two day gap,
// two esl readings and a few files of ignored sensors
// later this becomes a handful of real files in public/
export function demoFiles(): FileInfo[] {
  const files: FileInfo[] = [];
  let counter = 348_200;
  for (let day = 2; day <= 31; day++) {
    if (day === 13 || day === 14) continue;
    const date = `202101${String(day).padStart(2, "0")}`;
    for (let meter = 0; meter < 2; meter++) {
      const id = counter++;
      files.push({
        name: `${date}_0931${String(10 + meter).padStart(2, "0")}_12X-0000001216-O_E66_12X-LIPPUNEREM-T_ESLEVU${id}_${hash(`${id}`) % 2_000_000_000}.xml`,
        size: 14_400,
      });
    }
  }
  files.push(
    {
      name: "EdmRegisterWertExport_20210104_eslevu_20210104050446.xml",
      size: 3_565,
    },
    {
      name: "EdmRegisterWertExport_20210203_eslevu_20210203050512.xml",
      size: 3_565,
    },
  );
  for (let i = 0; i < 4; i++) {
    const id = 662_083 + i;
    files.push({
      name: `2025101${9 - (i >> 1)}_08011${i}_12X-0000001216-O_E66_12X-LIPPUNEREM-T_ESLEVU${id}_${hash(`x${id}`) % 2_000_000_000}.xml`,
      size: 14_400,
    });
  }
  return files;
}
