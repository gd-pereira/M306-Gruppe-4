import type { Messwert, Serie } from "@/lib/types";

export interface Duplikate {
  identisch: number; // copy had the same value as the one we kept
  ersetzt: number; // copy had a smaller value, usually 0 instead of the real value
}

// puts the sdat values of all files together, one series per direction
// the files overlap, so the same 15 min value can come more than once
// rule from the client: keep the bigger value, so the real value beats 0
export function zusammenfuehren(serien: Serie[]) {
  const ergebnis: Serie[] = [];
  const duplikate: Duplikate = { identisch: 0, ersetzt: 0 };

  for (const richtung of ["bezug", "einspeisung"] as const) {
    const dateien = serien.filter((s) => s.richtung === richtung);
    if (dateien.length === 0) continue;

    const behalten = groessteWerte(dateien);

    const gezaehlt = duplikateZaehlen(dateien, behalten);
    duplikate.identisch += gezaehlt.identisch;
    duplikate.ersetzt += gezaehlt.ersetzt;

    ergebnis.push({
      sensorId: richtung === "bezug" ? "ID742" : "ID735",
      richtung,
      art: "verbrauch",
      werte: sortierteListe(behalten),
    });
  }

  return { serien: ergebnis, duplikate };
}

// timestamp -> biggest value over all files
function groessteWerte(serien: Serie[]): Map<number, number> {
  const werte = new Map<number, number>();

  for (const serie of serien) {
    for (const { ts, wert } of serie.werte) {
      const bisher = werte.get(ts);
      if (bisher === undefined || wert > bisher) {
        werte.set(ts, wert);
      }
    }
  }

  return werte;
}

// every value we did not keep is a duplicate
// smaller than the kept value = ersetzt, same value = identisch
function duplikateZaehlen(
  serien: Serie[],
  behalten: Map<number, number>,
): Duplikate {
  let alleWerte = 0;
  let ersetzt = 0;

  for (const serie of serien) {
    for (const { ts, wert } of serie.werte) {
      alleWerte++;
      if (wert < behalten.get(ts)!) {
        ersetzt++;
      }
    }
  }

  const entfernt = alleWerte - behalten.size;
  return { identisch: entfernt - ersetzt, ersetzt };
}

function sortierteListe(werte: Map<number, number>): Messwert[] {
  return [...werte]
    .map(([ts, wert]) => ({ ts, wert }))
    .sort((a, b) => a.ts - b.ts);
}
