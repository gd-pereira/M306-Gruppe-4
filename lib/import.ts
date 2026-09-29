import { aggregateAllLevels, type ZoomLevel } from "@/lib/aggregate";
import { ESL_ROOT } from "@/lib/detect";
import {
  compareWithEsl,
  computeMeterReadings,
  type Comparison,
} from "@/lib/meter";
import { parseEsl } from "@/lib/parse-esl";
import { parseSdat } from "@/lib/parse-sdat";
import { findGaps, mergeSeries, type Gap } from "@/lib/timeseries";
import type {
  DataPoint,
  Direction,
  FileError,
  IgnoredFile,
  Series,
} from "@/lib/types";

// everything we found while reading the files, before putting it together
export interface ParsedFiles {
  sdat: Series[]; // one series per sdat file
  esl: Series[]; // up to two series per esl file (consumption and feed-in)
  eslFiles: number;
  placeholders: number; // skipped condition 21 values of all sdat files
  errors: FileError[];
  ignored: IgnoredFile[];
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
    } else {
      parsed.errors.push(result.error);
    }
    return;
  }

  const result = parseSdat(xml, file);
  if (result.ok) {
    parsed.sdat.push(result.series);
    parsed.placeholders += result.placeholders;
  } else if ("ignored" in result) {
    parsed.ignored.push(result.ignored);
  } else {
    parsed.errors.push(result.error);
  }
}

// puts all files of one direction together and calculates everything the charts need
function buildDirection(
  parsed: ParsedFiles,
  direction: Direction,
): DirectionData {
  const usage = mergeSeries(
    parsed.sdat.filter((series) => series.direction === direction),
  );
  const esl = mergeSeries(
    parsed.esl.filter((series) => series.direction === direction),
  );
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
  const consumption = buildDirection(parsed, "consumption");
  const feedIn = buildDirection(parsed, "feedIn");

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
    stats: {
      sdatFiles: parsed.sdat.length,
      eslFiles: parsed.eslFiles,
      placeholders: parsed.placeholders,
      duplicates,
    },
  };
}
