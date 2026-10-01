import { useSyncExternalStore } from "react";
import {
  cancelDataImport,
  getDataState,
  importFiles,
  resetDataStore,
  restoreDataStore,
} from "@/lib/data-store";
import {
  clearSavedData,
  deleteData,
  loadData,
  saveData,
} from "@/lib/saved-data";
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
  // true while the saved import is loaded after a reload, «Noch keine Daten» waits for it
  restoring: boolean;
}

const INITIAL_STATE: ImportState = {
  status: "empty",
  progress: null,
  failure: null,
  result: null,
  lastImport: null,
  restoring: false,
};

// the server never knows what the browser has saved, so the first render waits like a restore
const SERVER_STATE: ImportState = { ...INITIAL_STATE, restoring: true };

// what is kept in IndexedDB next to the ImportResult of lib/data-store
interface SavedImport {
  result: FakeImportResult;
  lastImport: { at: number; fileCount: number };
  // real files have their data in lib/data-store, the demo has none
  real: boolean;
}

export const NO_XML_FAILURE =
  "In der Auswahl wurden keine .xml-Dateien gefunden. Bitte den Ordner mit den SDAT- und ESL-Dateien wählen.";

const TICK_MS = 80;
const MERGE_MS = 1400;

// in the browser the saved import is loaded right away (see restore below)
let state: ImportState = {
  ...INITIAL_STATE,
  restoring: typeof window !== "undefined",
};
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
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
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
  const isReal = real.length === xml.length;
  const dataBefore = getDataState().result;
  // resolves once the real import is over (and its data is being saved)
  let dataDone: Promise<void> = Promise.resolve();
  if (isReal) {
    dataDone = importFiles(real);
  } else {
    // the demo replaces the data too, real data from before must not come back after a reload
    resetDataStore();
    void deleteData("data");
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
        const saved: SavedImport = {
          result: buildFakeResult(xml),
          lastImport: { at: Math.floor(Date.now() / 1000), fileCount: total },
          real: isReal,
        };
        setState({
          status: "ready",
          progress: null,
          result: saved.result,
          lastImport: saved.lastImport,
        });
        // saved after the data, so a reload never shows this file list with older data.
        // a failed or cancelled real import keeps the saved import from before
        void dataDone.then(() => {
          const dataSaved = !isReal || getDataState().result !== dataBefore;
          if (dataSaved && state.result === saved.result) {
            void saveData("import", saved);
          }
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
  // the real import stops too, otherwise it would replace the data in the background
  cancelDataImport();
  setState({ status: state.result ? "ready" : "empty", progress: null });
}

// «Gespeicherte Daten löschen»: empties memory and IndexedDB, the app is back at «Noch keine Daten»
export async function deleteSavedData(): Promise<void> {
  clearTimers();
  resetDataStore();
  setState({ ...INITIAL_STATE });
  await clearSavedData();
}

// loads the saved import after a reload, before «Noch keine Daten» is shown
// an import that was started in the meantime wins
async function restore(): Promise<void> {
  const [saved, hasData] = await Promise.all([
    loadData<SavedImport>("import"),
    restoreDataStore(),
  ]);
  // a real import whose data did not get saved (reload during the import) is not shown
  const usable = saved && (!saved.real || hasData);
  if (usable && state.status === "empty" && !state.result) {
    setState({
      status: "ready",
      result: saved.result,
      lastImport: saved.lastImport,
    });
  }
  setState({ restoring: false });
}

if (typeof window !== "undefined") {
  void restore();
}
