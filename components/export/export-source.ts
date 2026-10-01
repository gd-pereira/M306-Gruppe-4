import { useMemo } from "react";
import { getDataState, useDataStore } from "@/lib/data-store";
import { exportSeries } from "@/lib/export";
import type { ImportResult } from "@/lib/import";
import { SENSOR_IDS, type SensorId } from "@/lib/types";
import {
  dataWindow,
  EMPTY_WINDOW,
  type DataWindow,
  type ExportSource,
} from "./export-data";

// where the export takes its meter readings from: the imported data, empty series before
// the first import. uses the store, so only for client components

let real: { result: ImportResult; source: ExportSource } | null = null;

const emptySeries = (sensorId: SensorId) => ({
  sensorId,
  readings: [],
  gaps: [],
});
const EMPTY_SOURCE: ExportSource = {
  [SENSOR_IDS.consumption]: emptySeries(SENSOR_IDS.consumption),
  [SENSOR_IDS.feedIn]: emptySeries(SENSOR_IDS.feedIn),
};

export function exportSource(
  result: ImportResult | null = getDataState().result,
): ExportSource {
  if (!result) return EMPTY_SOURCE;
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

// the days of the imported data, EMPTY_WINDOW before the first import
export function useDataWindow(): DataWindow {
  const { result } = useDataStore();
  return result ? dataWindow(result) : EMPTY_WINDOW;
}
