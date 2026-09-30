import { useMemo, useSyncExternalStore } from "react";
import { bucketAt, type ZoomLevel } from "@/lib/aggregate";
import type { ImportResult } from "@/lib/import";
import { startImport } from "@/lib/start-import";
import { INTERVAL, pointsInRange } from "@/lib/timeseries";
import type { DataPoint, Direction } from "@/lib/types";

// the one place where the pages get their data from
// the data only lives in memory, a reload of the page starts empty again

// a time range in unix seconds, from is included and to is not
export interface TimeRange {
  from: number;
  to: number;
}

export interface DataState {
  // empty = nothing imported yet, failed = the last import crashed (old data is kept)
  status: "empty" | "importing" | "ready" | "failed";
  progress: { processed: number; total: number } | null; // only while importing
  failure: string | null; // only when failed
  // data of the last import that worked: consumption, feedIn, errors, ignored, files, stats
  result: ImportResult | null;
  bounds: TimeRange | null; // first to last value of all data, e.g. for date pickers
  range: TimeRange | null; // what the charts show, after an import it is the whole data
  lastImport: { at: number; fileCount: number } | null; // at in unix seconds
}

// the data of one direction in the chosen range
export interface DirectionRange {
  usage: DataPoint[];
  meterReading: DataPoint[];
  esl: DataPoint[]; // real esl readings, always unaggregated (about one per month)
}

export type RangeData = Record<Direction, DirectionRange>;

const INITIAL_STATE: DataState = {
  status: "empty",
  progress: null,
  failure: null,
  result: null,
  bounds: null,
  range: null,
  lastImport: null,
};

let state = INITIAL_STATE;
const listeners = new Set<() => void>();

// counts up with every import and reset, an import only writes its result if it is still the latest
// otherwise a reset during an import would be undone as soon as the import is done
let latestImport = 0;

// every change makes a new state object, so react sees that something changed
function setState(changes: Partial<DataState>): void {
  state = { ...state, ...changes };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDataState(): DataState {
  return state;
}

// react hook, the component renders again whenever the store changes
export function useDataStore(): DataState {
  // on the server there is never any data
  return useSyncExternalStore(subscribe, getDataState, () => INITIAL_STATE);
}

// from the first to 15 min after the last value, over both directions
// meter readings are not needed here, after aggregating they have the same ts as the usage
export function dataBounds(result: ImportResult): TimeRange | null {
  let from = Infinity;
  let to = -Infinity;

  for (const data of [result.consumption, result.feedIn]) {
    for (const points of [data.usage["15min"], data.esl]) {
      if (points.length > 0) {
        from = Math.min(from, points[0].ts);
        to = Math.max(to, points[points.length - 1].ts + INTERVAL);
      }
    }
  }

  return from === Infinity ? null : { from, to };
}

// reads the files in the background and replaces the old data when done
// resolves when the import is over, errors of single files are in result.errors,
// only a crash of the whole import ends up in failure
// a second call while an import is running is ignored
export async function importFiles(files: File[]): Promise<void> {
  if (state.status === "importing") {
    return;
  }
  const id = ++latestImport;

  setState({
    status: "importing",
    progress: { processed: 0, total: files.length },
    failure: null,
  });

  try {
    const result = await startImport(files, (processed, total) => {
      if (id === latestImport) {
        setState({ progress: { processed, total } });
      }
    });
    if (id !== latestImport) {
      return;
    }
    const bounds = dataBounds(result);

    setState({
      status: "ready",
      progress: null,
      result,
      bounds,
      range: bounds,
      lastImport: {
        at: Math.floor(Date.now() / 1000),
        fileCount: files.length,
      },
    });
  } catch (error) {
    if (id !== latestImport) {
      return;
    }
    setState({
      status: "failed",
      progress: null,
      failure: error instanceof Error ? error.message : String(error),
    });
  }
}

// sets the time range of the charts, the order of from and to does not matter
export function setRange(from: number, to: number): void {
  setState({ range: { from: Math.min(from, to), to: Math.max(from, to) } });
}

// throws away all data, e.g. for a "Daten löschen" button
// an import that is still running is dropped, its worker just finishes in the background
export function resetDataStore(): void {
  latestImport++;
  setState(INITIAL_STATE);
}

// the values of the zoom level in the range
// a bucket counts if part of it is in the range, e.g. range 15.03. to 15.05. on
// the month level gives march, april and may
function rangeData(
  result: ImportResult,
  range: TimeRange,
  level: ZoomLevel,
): RangeData {
  // move from back to the start of its bucket, so the first bucket is not lost
  const from = bucketAt(range.from, level).start;

  const directionRange = (direction: Direction): DirectionRange => {
    const data = result[direction];
    return {
      usage: pointsInRange(data.usage[level], from, range.to),
      meterReading: pointsInRange(data.meterReading[level], from, range.to),
      esl: pointsInRange(data.esl, range.from, range.to),
    };
  };

  return {
    consumption: directionRange("consumption"),
    feedIn: directionRange("feedIn"),
  };
}

// all values of the zoom level in the current range, null if there is no data
export function getRangeData(level: ZoomLevel): RangeData | null {
  const { result, range } = state;
  if (result === null || range === null) {
    return null;
  }
  return rangeData(result, range, level);
}

// react hook version of getRangeData, only recalculates when data, range or level change
export function useRangeData(level: ZoomLevel): RangeData | null {
  const { result, range } = useDataStore();

  return useMemo(() => {
    if (result === null || range === null) {
      return null;
    }
    return rangeData(result, range, level);
  }, [result, range, level]);
}
