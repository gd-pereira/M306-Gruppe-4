import { SENSOR_IDS, type SensorId } from "@/lib/types";
import {
  isDayKey,
  SENSORS,
  type DataWindow,
  type DayKey,
  type ExportSelection,
} from "./export-data";

type SearchParams = Record<string, string | string[] | undefined>;

export type ExportMode = "file" | "api";

function one(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export function modeFromParams(params: SearchParams): ExportMode {
  return params.modus === "api" ? "api" : "file";
}

export function sensorFromParams(params: SearchParams): SensorId {
  const sensor = one(params, "sensor");
  return SENSORS.some((s) => s.id === sensor)
    ? (sensor as SensorId)
    : SENSOR_IDS.consumption;
}

function clampDay(
  value: string | undefined,
  fallback: DayKey,
  window: DataWindow,
): DayKey {
  if (!value || !isDayKey(value)) return fallback;
  if (value < window.from) return window.from;
  if (value > window.to) return window.to;
  return value;
}

// ?sensor=ID742&von=2018-01-01&bis=2021-09-06, the same parameters the zählerstand page uses,
// the days are cut to the imported data
export function selectionFromParams(
  params: SearchParams,
  window: DataWindow,
): ExportSelection {
  return {
    format: one(params, "format") === "json" ? "json" : "csv",
    sensor: sensorFromParams(params),
    range: {
      from: clampDay(one(params, "von"), window.from, window),
      to: clampDay(one(params, "bis"), window.to, window),
    },
  };
}

export function selectionParams(
  selection: ExportSelection,
  mode: ExportMode = "file",
): URLSearchParams {
  const params = new URLSearchParams({
    sensor: selection.sensor,
    von: selection.range.from,
    bis: selection.range.to,
  });
  if (selection.format === "json") params.set("format", "json");
  if (mode === "api") params.set("modus", "api");
  return params;
}

// «Zurück zum Export» from the zählerstand, the export checks the values itself
export function exportBackHref(params: SearchParams): string {
  const keep = new URLSearchParams();
  for (const key of ["sensor", "von", "bis", "format"]) {
    const value = one(params, key);
    if (value) keep.set(key, value);
  }
  return `/export?${keep}`;
}

// quelle=export turns the header button of the zählerstand into «Zurück zum Export»
export function meterHref(selection: ExportSelection): string {
  const params = new URLSearchParams({
    sensor: selection.sensor,
    von: selection.range.from,
    bis: selection.range.to,
    quelle: "export",
  });
  if (selection.format === "json") params.set("format", "json");
  return `/zaehlerstand?${params}`;
}
