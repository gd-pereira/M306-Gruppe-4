import { ausschnitt, ersterIndexAb, INTERVALL } from "@/lib/timeseries";
import type { Messwert } from "@/lib/types";

// result of comparing sdat with esl for the time between two esl readings
// there is no allowed deviation: in the test data sdat is always 3x esl (confirmed by the client),
// so a limit would mark every month. months with missing sdat values are marked instead
export interface Vergleich {
  von: number; // ts of the first esl reading
  bis: number; // ts of the next esl reading
  sdat: number; // sum of all sdat values in between (kWh)
  esl: number; // difference of the two esl readings (kWh)
  vollstaendig: boolean; // false if some sdat values are missing in between
}

// adding up floats gives things like 19216.199999, so we round to 4 decimals
function runde(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// returns the esl reading that is closest in time to ts
// if both neighbours are equally far away, we take the earlier one
// esl must be sorted by ts and must not be empty
function naechsterEslWert(esl: Messwert[], ts: number): Messwert {
  const i = ersterIndexAb(esl, ts);

  // ts is before the first or after the last esl reading
  if (i === 0) {
    return esl[0];
  }
  if (i === esl.length) {
    return esl[esl.length - 1];
  }

  // otherwise ts lies between esl[i - 1] and esl[i]
  const davor = esl[i - 1];
  const danach = esl[i];
  if (ts - davor.ts <= danach.ts - ts) {
    return davor;
  }
  return danach;
}

// running total: summen[i] = usage of the first i values
// summen[0] is 0, summen[1] is the first value, summen[2] the first two, ...
// with this we get the usage between two times with one subtraction instead of a loop
function laufendeSummen(verbrauch: Messwert[]): number[] {
  const summen = [0];
  let total = 0;

  for (const messwert of verbrauch) {
    total += messwert.wert;
    summen.push(total);
  }

  return summen;
}

// calculates absolute meter readings from the 15 min usage (sdat) and a few known readings (esl)
// each sdat value is the usage from ts to ts + 15 min, so the reading belongs to the end of that interval
// we start at the closest esl reading: add the usage when going forward, subtract it when going backward
// without any esl reading we have no starting point, so we return nothing
export function berechneZaehlerstand(
  verbrauch: Messwert[],
  esl: Messwert[],
): Messwert[] {
  if (esl.length === 0) {
    return [];
  }

  const summen = laufendeSummen(verbrauch);
  const staende: Messwert[] = [];

  for (const messwert of verbrauch) {
    const ende = messwert.ts + INTERVALL;
    const referenz = naechsterEslWert(esl, ende);

    // usage of everything before "ende" and of everything before the esl reading
    const verbrauchBisEnde = summen[ersterIndexAb(verbrauch, ende)];
    const verbrauchBisReferenz = summen[ersterIndexAb(verbrauch, referenz.ts)];

    // positive if the esl reading is earlier (add), negative if it is later (subtract)
    const dazwischen = verbrauchBisEnde - verbrauchBisReferenz;

    staende.push({ ts: ende, wert: runde(referenz.wert + dazwischen) });
  }

  return staende;
}

// compares the sdat sum between two esl readings with the difference of those readings
// and checks if every 15 min value is there
// time ranges without any sdat value are skipped (e.g. after september 2021)
export function vergleicheMitEsl(
  verbrauch: Messwert[],
  esl: Messwert[],
): Vergleich[] {
  const vergleiche: Vergleich[] = [];

  for (let i = 1; i < esl.length; i++) {
    const von = esl[i - 1];
    const bis = esl[i];

    const werte = ausschnitt(verbrauch, von.ts, bis.ts);
    if (werte.length === 0) {
      continue;
    }

    let summe = 0;
    for (const messwert of werte) {
      summe += messwert.wert;
    }
    const sdat = runde(summe);
    const differenz = runde(bis.wert - von.wert);

    // a full range has one value every 15 min
    const erwartet = (bis.ts - von.ts) / INTERVALL;

    vergleiche.push({
      von: von.ts,
      bis: bis.ts,
      sdat,
      esl: differenz,
      vollstaendig: werte.length === erwartet,
    });
  }

  return vergleiche;
}
