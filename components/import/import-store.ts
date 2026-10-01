import { useMemo, useSyncExternalStore } from "react";
import {
  cancelDataImport,
  importFiles,
  resetDataStore,
  restoreDataStore,
  useDataStore,
  type DataState,
} from "@/lib/data-store";
import { clearSavedData } from "@/lib/saved-data";
import { clearOnboarded } from "@/components/app-shell/onboarding";
import { importView, isXml, type ImportView } from "./import-view";

// what the import page, the dashboard and the sidebar read: the state of lib/data-store with
// the ImportResult turned into the file table and summary (import-view.ts)

export interface ImportState {
  status: "empty" | "importing" | "ready" | "failed";
  progress: { processed: number; total: number } | null;
  failure: string | null;
  result: ImportView | null; // kept while importing and after a failure
  lastImport: { at: number; fileCount: number } | null;
  // true while the saved import is loaded after a reload, «Noch keine Daten» waits for it
  restoring: boolean;
}

export const NO_XML_FAILURE =
  "In der Auswahl wurden keine .xml-Dateien gefunden. Bitte den Ordner mit den SDAT- und ESL-Dateien wählen.";

// what lib/data-store does not know about
interface LocalState {
  // the import did not even start, e.g. no xml in the selection
  failure: string | null;
  restoring: boolean;
}

// the server never knows what the browser has saved, so the first render waits like a restore
const SERVER_LOCAL: LocalState = { failure: null, restoring: true };

let local: LocalState = {
  failure: null,
  restoring: typeof window !== "undefined",
};
const listeners = new Set<() => void>();

function setLocal(changes: Partial<LocalState>): void {
  local = { ...local, ...changes };
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function toImportState(data: DataState, own: LocalState): ImportState {
  const failed = own.failure !== null && data.status !== "importing";
  return {
    status: failed ? "failed" : data.status,
    progress: data.progress,
    failure: failed ? own.failure : data.failure,
    result: data.result ? importView(data.result) : null,
    lastImport: data.lastImport,
    restoring: own.restoring,
  };
}

export function useImportStore(): ImportState {
  const data = useDataStore();
  const own = useSyncExternalStore(
    subscribe,
    () => local,
    () => SERVER_LOCAL,
  );
  return useMemo(() => toImportState(data, own), [data, own]);
}

// non-xml files are skipped, only xml files are read and counted
export function startImport(files: File[]): void {
  const xml = files.filter((file) => isXml(file.name));
  if (xml.length === 0) {
    setLocal({ failure: NO_XML_FAILURE });
    return;
  }
  setLocal({ failure: null });
  void importFiles(xml);
}

// stops the import and throws away what was read, the data from before stays
export function cancelImport(): void {
  cancelDataImport();
}

// «Gespeicherte Daten löschen»: empties memory and IndexedDB, the app is back at «Noch keine Daten»
export async function deleteSavedData(): Promise<void> {
  resetDataStore();
  setLocal({ failure: null, restoring: false });
  clearOnboarded();
  await clearSavedData();
}

// loads the saved import after a reload, before «Noch keine Daten» is shown
// an import that was started in the meantime wins (restoreDataStore checks that)
async function restore(): Promise<void> {
  try {
    await restoreDataStore();
  } finally {
    setLocal({ restoring: false });
  }
}

if (typeof window !== "undefined") {
  void restore();
}
