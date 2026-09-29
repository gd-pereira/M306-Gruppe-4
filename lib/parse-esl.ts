import { ESL_ROOT } from "@/lib/detect";
import { roundKwh } from "@/lib/math";
import { zurichToUnix } from "@/lib/time";
import { SENSOR_IDS } from "@/lib/types";
import type { DataPoint, FileError, Series } from "@/lib/types";
import { parseXml, rootName } from "@/lib/xml";

export type EslResult =
  { ok: true; series: Series[] } | { ok: false; error: FileError };

// only the parts of the esl file we actually read
interface EslRoot {
  Header?: { created?: string };
  Meter?: {
    TimePeriod?: {
      end?: string;
      ValueRow?: { obis?: string; value?: string }[];
    }[];
  }[];
}

function fail(file: string, message: string): EslResult {
  return { ok: false, error: { file, message } };
}

// adds high and low tariff together
// if one of them is missing the sum would be wrong, so we return undefined
function addTariffs(
  readings: Record<string, number>,
  high: string,
  low: string,
): number | undefined {
  if (readings[high] === undefined || readings[low] === undefined) {
    return undefined;
  }
  return roundKwh(readings[high] + readings[low]);
}

// reads one esl file into absolute meter readings for consumption and feed-in
// never throws, problems end up in the error list instead
export function parseEsl(xml: string, file: string): EslResult {
  const result = parseXml(xml);
  if (!result.ok) {
    return fail(file, result.message);
  }

  if (rootName(result.doc) !== ESL_ROOT) {
    return fail(file, "Not an ESL file");
  }
  const root = (result.doc[ESL_ROOT] ?? {}) as EslRoot;

  const consumption: DataPoint[] = [];
  const feedIn: DataPoint[] = [];

  // some files have a second meter (water, obis 8-1:1.8.0), its codes just don't match below
  for (const meter of root.Meter ?? []) {
    for (const period of meter.TimePeriod ?? []) {
      // "end" has no time zone, it's swiss local time
      const ts = zurichToUnix(period.end ?? "");
      if (Number.isNaN(ts)) {
        return fail(file, `Invalid time: ${period.end}`);
      }

      // collect all readings of this period, e.g. { "1-1:1.8.1": 4755.3, ... }
      const readings: Record<string, number> = {};
      for (const row of period.ValueRow ?? []) {
        const value = Number(row.value);
        if (row.obis && row.value !== undefined && !Number.isNaN(value)) {
          readings[row.obis] = value;
        }
      }

      // 1.8.x = consumption, 2.8.x = feed-in (see Projektbeschreibung)
      const consumptionValue = addTariffs(readings, "1-1:1.8.1", "1-1:1.8.2");
      if (consumptionValue !== undefined) {
        consumption.push({ ts, value: consumptionValue });
      }

      const feedInValue = addTariffs(readings, "1-1:2.8.1", "1-1:2.8.2");
      if (feedInValue !== undefined) {
        feedIn.push({ ts, value: feedInValue });
      }
    }
  }

  consumption.sort((a, b) => a.ts - b.ts);
  feedIn.sort((a, b) => a.ts - b.ts);

  // the same readings show up in several esl files, the newest file wins (see timeseries.ts)
  // "created" is swiss local time like "end", missing counts as oldest
  const created = zurichToUnix(root.Header?.created ?? "");
  const createdAt = Number.isNaN(created) ? 0 : created;

  // esl has no sensor id, so we use the ids from the mapping table
  const series: Series[] = [];
  if (consumption.length > 0) {
    series.push({
      sensorId: SENSOR_IDS.consumption,
      direction: "consumption",
      kind: "meterReading",
      points: consumption,
      createdAt,
    });
  }
  if (feedIn.length > 0) {
    series.push({
      sensorId: SENSOR_IDS.feedIn,
      direction: "feedIn",
      kind: "meterReading",
      points: feedIn,
      createdAt,
    });
  }

  return { ok: true, series };
}
