import { useSyncExternalStore } from "react";
import { importFiles } from "@/lib/data-store";
import {
  buildFakeResult,
  isXml,
  type FakeImportResult,
  type FileInfo,
} from "./fake-import";

// frontend-only stand-in for lib/data-store.ts, same status values and the same idea:
// one module-level state, components subscribe with useImportStore()
// the import is simulated with timers, reading first and then merging (processed === total)

export interface ImportState {
  status: "empty" | "importing" | "ready" | "failed";
  progress: { processed: number; total: number } | null;
  failure: string | null;
  result: FakeImportResult | null; // kept while importing and after a failure
  lastImport: { at: number; fileCount: number } | null;
}

const INITIAL_STATE: ImportState = {
  status: "empty",
  progress: null,
  failure: null,
  result: null,
  lastImport: null,
};

export const NO_XML_FAILURE =
  "In der Auswahl wurden keine .xml-Dateien gefunden. Bitte den Ordner mit den SDAT- und ESL-Dateien wählen.";

const TICK_MS = 80;
const MERGE_MS = 1400;

let state = INITIAL_STATE;
const listeners = new Set<() => void>();
let timers: ReturnType<typeof setTimeout>[] = [];

function setState(changes: Partial<ImportState>): void {
  state = { ...state, ...changes };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): ImportState {
  return state;
}

export function useImportStore(): ImportState {
  return useSyncExternalStore(subscribe, getState, () => INITIAL_STATE);
}

function clearTimers(): void {
  for (const timer of timers) {
    clearTimeout(timer);
  }
  timers = [];
}

// non-xml files are skipped, only xml files count for the progress
export function startImport(files: FileInfo[]): void {
  if (state.status === "importing") {
    return;
  }
  const xml = files.filter((file) => isXml(file.name));
  if (xml.length === 0) {
    setState({ status: "failed", failure: NO_XML_FAILURE, progress: null });
    return;
  }

  // real files also go through the real import (lib/data-store), the export already reads from there
  // the demo only has made-up file names, so it stays fake
  const real = xml.filter(
    (file): file is File => typeof File !== "undefined" && file instanceof File,
  );
  if (real.length === xml.length) {
    void importFiles(real);
  }

  const total = xml.length;
  // between 1.5 s for a handful of files and 6 s for the full 5'180
  const readMs = Math.min(6000, Math.max(1500, total * 1.2));
  const ticks = Math.ceil(readMs / TICK_MS);

  setState({
    status: "importing",
    progress: { processed: 0, total },
    failure: null,
  });

  for (let tick = 1; tick <= ticks; tick++) {
    timers.push(
      setTimeout(() => {
        // eases out a little, the first files feel fast like in the real worker
        const share = 1 - Math.pow(1 - tick / ticks, 1.4);
        setState({
          progress: { processed: Math.round(share * total), total },
        });
      }, tick * TICK_MS),
    );
  }

  timers.push(
    setTimeout(
      () => {
        timers = [];
        setState({
          status: "ready",
          progress: null,
          result: buildFakeResult(xml),
          lastImport: { at: Math.floor(Date.now() / 1000), fileCount: total },
        });
      },
      ticks * TICK_MS + MERGE_MS,
    ),
  );
}

// stops the import and throws away what was read, the data from before stays
export function cancelImport(): void {
  if (state.status !== "importing") {
    return;
  }
  clearTimers();
  setState({ status: state.result ? "ready" : "empty", progress: null });
}
