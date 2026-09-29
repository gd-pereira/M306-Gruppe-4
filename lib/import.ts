import { aggregateAllLevels, type ZoomLevel } from "@/lib/aggregate";
import { ESL_ROOT, SDAT_ROOT_PREFIX, type FileType } from "@/lib/detect";
import {
  compareWithEsl,
  computeMeterReadings,
  type Comparison,
} from "@/lib/meter";
import { parseEsl } from "@/lib/parse-esl";
import { parseSdat } from "@/lib/parse-sdat";
import { findGaps, mergeSeriesWithSources, type Gap } from "@/lib/timeseries";
import type {
  DataPoint,
  Direction,
  FileError,
  IgnoredFile,
  Series,
} from "@/lib/types";

// imported = at least one of its values is used
// duplicate = the file is fine, but newer files (or one read before with the same
// creation date) already had every one of its values, so none of them is used
export type FileStatus = "imported" | "duplicate" | "ignored" | "error";

// one row of the file table on the import page
export interface ImportedFile {
  file: string;
  type: FileType | null; // null if it is neither sdat nor esl
  sensorIds: string[]; // one for sdat, up to two for esl, none for broken files
  directions: Direction[]; // empty for ignored and broken files
  from: number | null; // ts of the first value (unix seconds), null if there is none
  status: FileStatus;
  message?: string; // only for errors, same text as in errors
}

// a file row while reading, duplicates are only known after merging all files
interface ParsedFile extends Omit<ImportedFile, "status"> {
  status: "imported" | "ignored" | "error";
  series: Series[];
}

// everything we found while reading the files, before putting it together
export interface ParsedFiles {
  sdat: Series[]; // one series per sdat file
  esl: Series[]; // up to two series per esl file (consumption and feed-in)
  eslFiles: number;
  placeholders: number; // skipped condition 21 values of all sdat files
  errors: FileError[];
  ignored: IgnoredFile[];
  files: ParsedFile[]; // in the order they were read
}

// the finished data of one direction, this is what the charts use
export interface DirectionData {
  usage: Record<ZoomLevel, DataPoint[]>; // sdat usage for every zoom level
  meterReading: Record<ZoomLevel, DataPoint[]>; // calculated meter reading for every zoom level
  esl: DataPoint[]; // the real esl readings, these go on after sdat ends (09/2021)
  valueCount: number; // 15 min values after merging the files
  gaps: Gap[];
  comparisons: Comparison[]; // sdat vs esl per month, incomplete months are marked
}

export interface ImportResult {
  consumption: DirectionData;
  feedIn: DirectionData;
  errors: FileError[];
  ignored: IgnoredFile[];
  files: ImportedFile[]; // every file that was read, in the same order
  stats: {
    sdatFiles: number;
    eslFiles: number;
    placeholders: number;
    duplicates: number; // values that came more than once, only one of them is kept
  };
}

// messages from the import worker to the page
// when processed === total all files are read and the worker is putting them together,
// the result comes with the next message
export type WorkerMessage =
  | { type: "progress"; processed: number; total: number }
  | { type: "result"; result: ImportResult }
  | { type: "error"; message: string };

export function createParsedFiles(): ParsedFiles {
  return {
    sdat: [],
    esl: [],
    eslFiles: 0,
    placeholders: 0,
    errors: [],
    ignored: [],
    files: [],
  };
}

// file row for a file that could be read
function readRow(file: string, type: FileType, series: Series[]): ParsedFile {
  let from: number | null = null;
  for (const { points } of series) {
    if (points.length > 0 && (from === null || points[0].ts < from)) {
      from = points[0].ts;
    }
  }

  return {
    file,
    type,
    sensorIds: [...new Set(series.map((s) => s.sensorId))],
    directions: series.map((s) => s.direction),
    from,
    status: "imported",
    series,
  };
}

function errorRow(error: FileError, type: FileType | null): ParsedFile {
  return {
    file: error.file,
    type,
    sensorIds: [],
    directions: [],
    from: null,
    status: "error",
    message: error.message,
    series: [],
  };
}

// reads one file and adds what it found to parsed
// esl files are easy to spot by their root tag, everything else goes to the sdat parser.
// detectFileType would parse every file twice, that made the import about twice as slow.
// broken or unknown files get their error message from the sdat parser
export function addFile(parsed: ParsedFiles, file: string, xml: string): void {
  if (xml.includes(`<${ESL_ROOT}`)) {
    const result = parseEsl(xml, file);
    if (result.ok) {
      parsed.esl.push(...result.series);
      parsed.eslFiles++;
      parsed.files.push(readRow(file, "esl", result.series));
    } else {
      parsed.errors.push(result.error);
      parsed.files.push(errorRow(result.error, "esl"));
    }
    return;
  }

  const result = parseSdat(xml, file);
  if (result.ok) {
    parsed.sdat.push(result.series);
    parsed.placeholders += result.placeholders;
    parsed.files.push(readRow(file, "sdat", [result.series]));
  } else if ("ignored" in result) {
    parsed.ignored.push(result.ignored);
    parsed.files.push({
      file,
      type: "sdat",
      sensorIds: [result.ignored.sensorId],
      directions: [],
      from: null,
      status: "ignored",
      series: [],
    });
  } else {
    parsed.errors.push(result.error);
    // everything that is not esl lands here, so only call it sdat if it looks like one
    const type = xml.includes(SDAT_ROOT_PREFIX) ? "sdat" : null;
    parsed.files.push(errorRow(result.error, type));
  }
}

// true if the file has values but none of them made it into the merged data
// files without any values (e.g. only placeholders) are not duplicates, they just add nothing
function isDuplicate(series: Series[], used: Set<Series>): boolean {
  const withValues = series.filter((s) => s.points.length > 0);
  return withValues.length > 0 && withValues.every((s) => !used.has(s));
}

// puts all files of one direction together and calculates everything the charts need
// every series that gave at least one value is added to used
function buildDirection(
  parsed: ParsedFiles,
  direction: Direction,
  used: Set<Series>,
): DirectionData {
  const sdat = mergeSeriesWithSources(
    parsed.sdat.filter((series) => series.direction === direction),
  );
  const eslMerged = mergeSeriesWithSources(
    parsed.esl.filter((series) => series.direction === direction),
  );
  for (const series of [...sdat.used, ...eslMerged.used]) {
    used.add(series);
  }

  const usage = sdat.points;
  const esl = eslMerged.points;
  const meterReading = computeMeterReadings(usage, esl);

  return {
    usage: aggregateAllLevels(usage, "usage"),
    meterReading: aggregateAllLevels(meterReading, "meterReading"),
    esl,
    valueCount: usage.length,
    gaps: findGaps(usage),
    comparisons: compareWithEsl(usage, esl),
  };
}

// called once after all files are read
export function buildResult(parsed: ParsedFiles): ImportResult {
  const used = new Set<Series>();
  const consumption = buildDirection(parsed, "consumption", used);
  const feedIn = buildDirection(parsed, "feedIn", used);

  // the series are only needed here, the page gets the rows without them
  const files: ImportedFile[] = parsed.files.map(({ series, ...row }) => ({
    ...row,
    status:
      row.status === "imported" && isDuplicate(series, used)
        ? "duplicate"
        : row.status,
  }));

  // every value we read but did not keep was a duplicate
  let totalValues = 0;
  for (const series of parsed.sdat) {
    totalValues += series.points.length;
  }
  const duplicates = totalValues - consumption.valueCount - feedIn.valueCount;

  return {
    consumption,
    feedIn,
    errors: parsed.errors,
    ignored: parsed.ignored,
    files,
    stats: {
      sdatFiles: parsed.sdat.length,
      eslFiles: parsed.eslFiles,
      placeholders: parsed.placeholders,
      duplicates,
    },
  };
}
