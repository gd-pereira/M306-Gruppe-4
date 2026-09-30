import { useMemo } from "react";
import { getDataState, useDataStore } from "@/lib/data-store";
import { exportSeries } from "@/lib/export";
import type { ImportResult } from "@/lib/import";
import { fakeExportSource, type ExportSource } from "./fake-export";

// where the export takes its meter readings from: the real import as soon as there is one,
// the made-up curve (demo) before that. uses the store, so only for client components

let real: { result: ImportResult; source: ExportSource } | null = null;

export function exportSource(
  result: ImportResult | null = getDataState().result,
): ExportSource {
  if (!result) return fakeExportSource();
  if (real?.result !== result) {
    real = { result, source: exportSeries(result) };
  }
  return real.source;
}

// react hook, gives a new source after every import so the screen updates
export function useExportSource(): ExportSource {
  const { result } = useDataStore();
  return useMemo(() => exportSource(result), [result]);
}
