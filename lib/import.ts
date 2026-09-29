import { vorberechnen, type Stufe } from "@/lib/aggregate";
import { ESL_ROOT } from "@/lib/detect";
import {
  berechneZaehlerstand,
  vergleicheMitEsl,
  type Vergleich,
} from "@/lib/meter";
import { parseEsl } from "@/lib/parse-esl";
import { parseSdat } from "@/lib/parse-sdat";
import { findeLuecken, zusammenfuehren, type Luecke } from "@/lib/timeseries";
import type { Fehler, Ignoriert, Messwert, Richtung, Serie } from "@/lib/types";

// everything we found while reading the files, before putting it together
export interface Sammlung {
  sdat: Serie[]; // one series per sdat file
  esl: Serie[]; // up to two series per esl file (bezug and einspeisung)
  eslDateien: number;
  platzhalter: number; // skipped condition 21 values of all sdat files
  fehler: Fehler[];
  ignoriert: Ignoriert[];
}

// the finished data of one direction, this is what the charts use
export interface Richtungsdaten {
  verbrauch: Record<Stufe, Messwert[]>; // sdat usage for every zoom level
  zaehlerstand: Record<Stufe, Messwert[]>; // calculated meter reading for every zoom level
  esl: Messwert[]; // the real esl readings, these go on after sdat ends (09/2021)
  anzahlWerte: number; // 15 min values after merging the files
  luecken: Luecke[];
  vergleiche: Vergleich[]; // sdat vs esl per month, incomplete months are marked
}

export interface ImportErgebnis {
  bezug: Richtungsdaten;
  einspeisung: Richtungsdaten;
  fehler: Fehler[];
  ignoriert: Ignoriert[];
  statistik: {
    sdatDateien: number;
    eslDateien: number;
    platzhalter: number;
    duplikate: number; // values that came more than once, only one of them is kept
  };
}

// messages from the import worker to the page
// when fertig === total all files are read and the worker is putting them together,
// the result comes with the next message
export type WorkerNachricht =
  | { typ: "fortschritt"; fertig: number; total: number }
  | { typ: "fertig"; ergebnis: ImportErgebnis }
  | { typ: "abbruch"; meldung: string };

export function neueSammlung(): Sammlung {
  return {
    sdat: [],
    esl: [],
    eslDateien: 0,
    platzhalter: 0,
    fehler: [],
    ignoriert: [],
  };
}

// reads one file and adds what it found to the sammlung
// esl files are easy to spot by their root tag, everything else goes to the sdat parser.
// detectDateityp would parse every file twice, that made the import about twice as slow.
// broken or unknown files get their error message from the sdat parser
export function dateiEinlesen(
  sammlung: Sammlung,
  datei: string,
  xml: string,
): void {
  if (xml.includes(`<${ESL_ROOT}`)) {
    const ergebnis = parseEsl(xml, datei);
    if (ergebnis.ok) {
      sammlung.esl.push(...ergebnis.serien);
      sammlung.eslDateien++;
    } else {
      sammlung.fehler.push(ergebnis.fehler);
    }
    return;
  }

  const ergebnis = parseSdat(xml, datei);
  if (ergebnis.ok) {
    sammlung.sdat.push(ergebnis.serie);
    sammlung.platzhalter += ergebnis.platzhalter;
  } else if ("ignoriert" in ergebnis) {
    sammlung.ignoriert.push(ergebnis.ignoriert);
  } else {
    sammlung.fehler.push(ergebnis.fehler);
  }
}

// puts all files of one direction together and calculates everything the charts need
function richtungAuswerten(
  sammlung: Sammlung,
  richtung: Richtung,
): Richtungsdaten {
  const verbrauch = zusammenfuehren(
    sammlung.sdat.filter((serie) => serie.richtung === richtung),
  );
  const esl = zusammenfuehren(
    sammlung.esl.filter((serie) => serie.richtung === richtung),
  );
  const zaehlerstand = berechneZaehlerstand(verbrauch, esl);

  return {
    verbrauch: vorberechnen(verbrauch, "verbrauch"),
    zaehlerstand: vorberechnen(zaehlerstand, "zaehlerstand"),
    esl,
    anzahlWerte: verbrauch.length,
    luecken: findeLuecken(verbrauch),
    vergleiche: vergleicheMitEsl(verbrauch, esl),
  };
}

// called once after all files are read
export function auswerten(sammlung: Sammlung): ImportErgebnis {
  const bezug = richtungAuswerten(sammlung, "bezug");
  const einspeisung = richtungAuswerten(sammlung, "einspeisung");

  // every value we read but did not keep was a duplicate
  let alleWerte = 0;
  for (const serie of sammlung.sdat) {
    alleWerte += serie.werte.length;
  }
  const duplikate = alleWerte - bezug.anzahlWerte - einspeisung.anzahlWerte;

  return {
    bezug,
    einspeisung,
    fehler: sammlung.fehler,
    ignoriert: sammlung.ignoriert,
    statistik: {
      sdatDateien: sammlung.sdat.length,
      eslDateien: sammlung.eslDateien,
      platzhalter: sammlung.platzhalter,
      duplikate,
    },
  };
}
