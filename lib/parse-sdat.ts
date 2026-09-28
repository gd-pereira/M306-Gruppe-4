import { SDAT_ROOT_PREFIX } from "@/lib/detect";
import type { Fehler, Messwert, Richtung, Serie } from "@/lib/types";
import { parseXml, rootName } from "@/lib/xml";

export type SdatErgebnis =
  { ok: true; serie: Serie } | { ok: false; fehler: Fehler };

// only the parts of the sdat file we actually read
interface SdatRoot {
  ValidatedMeteredData_HeaderInformation?: {
    InstanceDocument?: { DocumentID?: string };
  };
  MeteringData?: {
    Interval?: { StartDateTime?: string };
    Resolution?: { Resolution?: string; Unit?: string };
    ConsumptionMeteringPoint?: unknown;
    ProductionMeteringPoint?: unknown;
    Observation?: {
      Position?: { Sequence?: string };
      Volume?: string;
    }[];
  };
}

const FIFTEEN_MINUTES = 15 * 60; // in seconds

function error(datei: string, meldung: string): SdatErgebnis {
  return { ok: false, fehler: { datei, meldung } };
}

// reads one sdat file into a series of 15 min usage values
// never throws, problems end up in the error list instead
export function parseSdat(xml: string, datei: string): SdatErgebnis {
  const result = parseXml(xml);
  if (!result.ok) {
    return error(datei, result.meldung);
  }

  const rootKey = rootName(result.doc) ?? "";
  if (!rootKey.startsWith(SDAT_ROOT_PREFIX)) {
    return error(datei, "Keine SDAT-Datei");
  }
  const root = result.doc[rootKey] as SdatRoot;

  // DocumentID looks like "eslevu121963_BR2294_ID742", we want the "ID742" at the end
  const documentId =
    root.ValidatedMeteredData_HeaderInformation?.InstanceDocument?.DocumentID ??
    "";
  const match = documentId.match(/_(ID\d+)$/);
  const sensorId = match ? match[1] : "unbekannt";

  const data = root.MeteringData;
  if (!data) {
    return error(datei, "MeteringData fehlt");
  }

  // the direction comes from the tag name, not from the sensor id
  let richtung: Richtung;
  if (data.ConsumptionMeteringPoint !== undefined) {
    richtung = "bezug";
  } else if (data.ProductionMeteringPoint !== undefined) {
    richtung = "einspeisung";
  } else {
    return error(datei, "Weder Consumption- noch ProductionMeteringPoint");
  }

  // we only handle 15 min values for now (ID26263 has monthly values)
  const resolution = data.Resolution;
  if (resolution?.Resolution !== "15" || resolution?.Unit !== "MIN") {
    return error(datei, "Keine 15-Minuten-Auflösung");
  }

  // start time is in UTC ("...Z"), Date.parse gives milliseconds
  const start = Date.parse(data.Interval?.StartDateTime ?? "") / 1000;
  if (Number.isNaN(start)) {
    return error(datei, "Ungültige StartDateTime");
  }

  const werte: Messwert[] = [];
  for (const observation of data.Observation ?? []) {
    const sequence = Number(observation.Position?.Sequence);
    const wert = Number(observation.Volume);

    if (!Number.isInteger(sequence) || sequence < 1 || Number.isNaN(wert)) {
      return error(datei, `Ungültige Observation (Sequence ${sequence})`);
    }

    // sequence starts at 1, so the first value is exactly at the start time
    const ts = start + (sequence - 1) * FIFTEEN_MINUTES;
    werte.push({ ts, wert });
  }

  if (werte.length === 0) {
    return error(datei, "Keine Messwerte");
  }

  werte.sort((a, b) => a.ts - b.ts);

  return {
    ok: true,
    serie: { sensorId, richtung, art: "verbrauch", werte },
  };
}
