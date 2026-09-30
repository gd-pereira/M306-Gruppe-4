import { SENSOR_IDS, type SensorId } from "@/lib/types";
import {
  DATA_END,
  DATA_START,
  isDayKey,
  SENSORS,
  type DayKey,
  type ExportSelection,
} from "./fake-export";

type SearchParams = Record<string, string | string[] | undefined>;

export type ExportMode = "file" | "api";

export function modeFromParams(params: SearchParams): ExportMode {
  return params.modus === "api" ? "api" : "file";
}

function clampDay(value: string | undefined, fallback: DayKey): DayKey {
  if (!value || !isDayKey(value)) return fallback;
  if (value < DATA_START) return DATA_START;
  if (value > DATA_END) return DATA_END;
  return value;
}

// ?sensor=ID742&von=2018-01-01&bis=2021-09-06, the same parameters the zählerstand page uses
export function selectionFromParams(params: SearchParams): ExportSelection {
  const one = (key: string) => {
    const value = params[key];
    return typeof value === "string" ? value : undefined;
  };
  const sensor = one("sensor");
  return {
    format: one("format") === "json" ? "json" : "csv",
    sensor: SENSORS.some((s) => s.id === sensor)
      ? (sensor as SensorId)
      : SENSOR_IDS.consumption,
    range: {
      from: clampDay(one("von"), DATA_START),
      to: clampDay(one("bis"), DATA_END),
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

export function meterHref(selection: ExportSelection): string {
  const { sensor, range } = selection;
  return `/zaehlerstand?${new URLSearchParams({ sensor, von: range.from, bis: range.to })}`;
}
