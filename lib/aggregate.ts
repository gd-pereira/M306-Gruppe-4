import { INTERVALL } from "@/lib/timeseries";
import type { Messwert, Serie } from "@/lib/types";
import { zurichZuUnix } from "@/lib/zeit";

// zoom levels of the chart, from fine to coarse
export const STUFEN = ["15min", "stunde", "tag", "woche", "monat"] as const;
export type Stufe = (typeof STUFEN)[number];

// a time section, von is included and bis is not (unix seconds)
interface Abschnitt {
  von: number;
  bis: number;
}

const STUNDE = 60 * 60;

// adding up floats gives things like 19216.199999, so we round to 4 decimals
function runde(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// year, month (1-12) and day of a moment in swiss local time
function zurichDatum(ts: number): { jahr: number; monat: number; tag: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ts * 1000));

  const teil = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { jahr: teil("year"), monat: teil("month"), tag: teil("day") };
}

// unix seconds of midnight swiss time on that day
// Date.UTC handles overflow, so day 32 or month 13 just roll over to the next month or year
function mitternacht(jahr: number, monat: number, tag: number): number {
  const iso = new Date(Date.UTC(jahr, monat - 1, tag))
    .toISOString()
    .slice(0, 10);
  return zurichZuUnix(`${iso}T00:00:00`);
}

// the section of the given zoom level that contains ts
// hours can be calculated directly because the swiss offset is always a full hour,
// days, weeks and months start at midnight swiss time and are 23 or 25 hours longer or shorter
// when the clock changes, so for those we go through the calendar
function abschnittVon(ts: number, stufe: Stufe): Abschnitt {
  if (stufe === "15min" || stufe === "stunde") {
    const laenge = stufe === "15min" ? INTERVALL : STUNDE;
    const von = Math.floor(ts / laenge) * laenge;
    return { von, bis: von + laenge };
  }

  const { jahr, monat, tag } = zurichDatum(ts);

  if (stufe === "tag") {
    return {
      von: mitternacht(jahr, monat, tag),
      bis: mitternacht(jahr, monat, tag + 1),
    };
  }

  if (stufe === "woche") {
    // weeks start on monday, getUTCDay gives 0 for sunday
    const wochentag = new Date(Date.UTC(jahr, monat - 1, tag)).getUTCDay();
    const montag = tag - ((wochentag + 6) % 7);
    return {
      von: mitternacht(jahr, monat, montag),
      bis: mitternacht(jahr, monat, montag + 7),
    };
  }

  return {
    von: mitternacht(jahr, monat, 1),
    bis: mitternacht(jahr, monat + 1, 1),
  };
}

// combines the values per section of the zoom level, ts of the result is the start of the section
// verbrauch: sum of all values in the section
// zaehlerstand: the last reading in the section. a reading belongs to the end of its interval
// (see berechneZaehlerstand), so a reading at exactly 00:00 is the end of the day before
// werte must be sorted by ts
export function zusammenfassen(
  werte: Messwert[],
  art: Serie["art"],
  stufe: Stufe,
): Messwert[] {
  const ergebnis: Messwert[] = [];
  // readings are shifted by one second so a reading on the border counts to the section before
  const verschiebung = art === "zaehlerstand" ? 1 : 0;

  let aktuell: Abschnitt | undefined;
  let wert = 0;

  for (const messwert of werte) {
    const ts = messwert.ts - verschiebung;

    // only ask the calendar when we leave the current section, not for every value
    if (aktuell === undefined || ts >= aktuell.bis) {
      if (aktuell !== undefined) {
        ergebnis.push({ ts: aktuell.von, wert: runde(wert) });
      }
      aktuell = abschnittVon(ts, stufe);
      wert = 0;
    }

    wert = art === "verbrauch" ? wert + messwert.wert : messwert.wert;
  }

  if (aktuell !== undefined) {
    ergebnis.push({ ts: aktuell.von, wert: runde(wert) });
  }

  return ergebnis;
}

// calculates all zoom levels at once, so switching in the chart needs no calculation
export function vorberechnen(
  werte: Messwert[],
  art: Serie["art"],
): Record<Stufe, Messwert[]> {
  const stufen = {} as Record<Stufe, Messwert[]>;
  for (const stufe of STUFEN) {
    stufen[stufe] = zusammenfassen(werte, art, stufe);
  }
  return stufen;
}
