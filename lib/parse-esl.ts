import { ESL_ROOT } from "@/lib/detect";
import type { Fehler, Messwert, Serie } from "@/lib/types";
import { parseXml, rootName } from "@/lib/xml";
import { zurichZuUnix } from "@/lib/zeit";

export type EslErgebnis =
  { ok: true; serien: Serie[] } | { ok: false; fehler: Fehler };

// only the parts of the esl file we actually read
interface EslRoot {
  Meter?: {
    TimePeriod?: {
      end?: string;
      ValueRow?: { obis?: string; value?: string }[];
    }[];
  }[];
}

function error(datei: string, meldung: string): EslErgebnis {
  return { ok: false, fehler: { datei, meldung } };
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
  const sum = readings[high] + readings[low];
  // 4755.3 + 14460.9 gives 19216.199999... in js, so round it
  return Math.round(sum * 10000) / 10000;
}

// reads one esl file into absolute meter readings for bezug and einspeisung
// never throws, problems end up in the error list instead
export function parseEsl(xml: string, datei: string): EslErgebnis {
  const result = parseXml(xml);
  if (!result.ok) {
    return error(datei, result.meldung);
  }

  if (rootName(result.doc) !== ESL_ROOT) {
    return error(datei, "Keine ESL-Datei");
  }
  const root = (result.doc[ESL_ROOT] ?? {}) as EslRoot;

  const bezug: Messwert[] = [];
  const einspeisung: Messwert[] = [];

  // some files have a second meter (water, obis 8-1:1.8.0), its codes just don't match below
  for (const meter of root.Meter ?? []) {
    for (const period of meter.TimePeriod ?? []) {
      // "end" has no time zone, it's swiss local time
      const ts = zurichZuUnix(period.end ?? "");
      if (Number.isNaN(ts)) {
        return error(datei, `Ungültiger Zeitpunkt: ${period.end}`);
      }

      // collect all readings of this period, e.g. { "1-1:1.8.1": 4755.3, ... }
      const readings: Record<string, number> = {};
      for (const row of period.ValueRow ?? []) {
        const wert = Number(row.value);
        if (row.obis && row.value !== undefined && !Number.isNaN(wert)) {
          readings[row.obis] = wert;
        }
      }

      // 1.8.x = bezug, 2.8.x = einspeisung (see Projektbeschreibung)
      const bezugWert = addTariffs(readings, "1-1:1.8.1", "1-1:1.8.2");
      if (bezugWert !== undefined) {
        bezug.push({ ts, wert: bezugWert });
      }

      const einspeisungWert = addTariffs(readings, "1-1:2.8.1", "1-1:2.8.2");
      if (einspeisungWert !== undefined) {
        einspeisung.push({ ts, wert: einspeisungWert });
      }
    }
  }

  bezug.sort((a, b) => a.ts - b.ts);
  einspeisung.sort((a, b) => a.ts - b.ts);

  // esl has no sensor id, so we use the ids from the mapping table
  const serien: Serie[] = [];
  if (bezug.length > 0) {
    serien.push({
      sensorId: "ID742",
      richtung: "bezug",
      art: "zaehlerstand",
      werte: bezug,
    });
  }
  if (einspeisung.length > 0) {
    serien.push({
      sensorId: "ID735",
      richtung: "einspeisung",
      art: "zaehlerstand",
      werte: einspeisung,
    });
  }

  return { ok: true, serien };
}
