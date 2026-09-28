import { SDAT_ROOT_PREFIX } from "@/lib/detect";
import type { Fehler, Messwert, Richtung, Serie } from "@/lib/types";
import { parseXml, rootName } from "@/lib/xml";

export type SdatErgebnis =
  { ok: true; serie: Serie } | { ok: false; fehler: Fehler };

// Nur die Teile des SDAT-XML, die gelesen werden
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

const RESOLUTION_SECONDS = 15 * 60;

export function parseSdat(xml: string, datei: string): SdatErgebnis {
  const fehler = (meldung: string): SdatErgebnis => ({
    ok: false,
    fehler: { datei, meldung },
  });

  const result = parseXml(xml);
  if (!result.ok) return fehler(result.meldung);

  const rootKey = rootName(result.doc);
  if (!rootKey?.startsWith(SDAT_ROOT_PREFIX)) {
    return fehler("Keine SDAT-Datei");
  }
  const root = result.doc[rootKey] as SdatRoot;

  const documentId =
    root.ValidatedMeteredData_HeaderInformation?.InstanceDocument?.DocumentID;
  const sensorId = documentId?.match(/_(ID\d+)$/)?.[1] ?? "unbekannt";

  const md = root.MeteringData;
  if (!md) return fehler("MeteringData fehlt");

  let richtung: Richtung;
  if (md.ConsumptionMeteringPoint !== undefined) richtung = "bezug";
  else if (md.ProductionMeteringPoint !== undefined) richtung = "einspeisung";
  else return fehler("Weder Consumption- noch ProductionMeteringPoint");

  if (md.Resolution?.Resolution !== "15" || md.Resolution?.Unit !== "MIN") {
    return fehler("Keine 15-Minuten-Auflösung");
  }

  const start = Date.parse(md.Interval?.StartDateTime ?? "") / 1000;
  if (Number.isNaN(start)) return fehler("Ungültige StartDateTime");

  const werte: Messwert[] = [];
  for (const obs of md.Observation ?? []) {
    const sequence = Number(obs.Position?.Sequence);
    const wert = Number(obs.Volume);
    if (!Number.isInteger(sequence) || sequence < 1 || Number.isNaN(wert)) {
      return fehler(
        `Ungültige Observation (Sequence ${obs.Position?.Sequence})`,
      );
    }
    werte.push({ ts: start + (sequence - 1) * RESOLUTION_SECONDS, wert });
  }
  if (werte.length === 0) return fehler("Keine Messwerte");

  werte.sort((a, b) => a.ts - b.ts);

  return {
    ok: true,
    serie: { sensorId, richtung, art: "verbrauch", werte },
  };
}
