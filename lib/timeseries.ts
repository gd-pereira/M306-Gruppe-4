import type { Messwert, Serie } from "@/lib/types";

// sdat values are 15 min apart, in seconds
export const INTERVALL = 15 * 60;

// a time range without any values, von is included and bis is not
export interface Luecke {
  von: number;
  bis: number;
}

// puts all series of one sensor into a single list, one value per timestamp
// works for sdat (usage) and esl (meter readings), just don't mix the two
// the same timestamp often shows up in several files,
// then the value from the file with the newest creation date wins
// (sdat placeholders with condition 21 were already removed by the parser)
export function zusammenfuehren(serien: Serie[]): Messwert[] {
  // timestamp -> best value so far and the creation date of its file
  const besteWerte = new Map<number, { wert: number; erstellt: number }>();

  for (const serie of serien) {
    const erstellt = serie.erstellt ?? 0;

    for (const messwert of serie.werte) {
      const bisher = besteWerte.get(messwert.ts);

      // take the value if we have none yet or if this file is newer
      if (bisher === undefined || erstellt > bisher.erstellt) {
        besteWerte.set(messwert.ts, { wert: messwert.wert, erstellt });
      }
    }
  }

  // turn the map back into a normal list
  const werte: Messwert[] = [];
  for (const [ts, eintrag] of besteWerte) {
    werte.push({ ts, wert: eintrag.wert });
  }

  werte.sort((a, b) => a.ts - b.ts);
  return werte;
}

// finds all places where values are missing
// werte must be sorted by ts
export function findeLuecken(werte: Messwert[]): Luecke[] {
  const luecken: Luecke[] = [];

  for (let i = 1; i < werte.length; i++) {
    // the next value should come exactly 15 min after the one before
    const erwartet = werte[i - 1].ts + INTERVALL;

    if (werte[i].ts > erwartet) {
      luecken.push({ von: erwartet, bis: werte[i].ts });
    }
  }

  return luecken;
}

// returns the index of the first value with a ts >= the given time
// if there is none, it returns werte.length
// uses binary search: look at the middle, then keep only the half that can contain the answer
// so for 128'000 values we only need about 17 steps instead of going through all of them
export function ersterIndexAb(werte: Messwert[], ts: number): number {
  let links = 0;
  let rechts = werte.length;

  while (links < rechts) {
    const mitte = Math.floor((links + rechts) / 2);

    if (werte[mitte].ts < ts) {
      // the middle is too early, so the answer is on the right side
      links = mitte + 1;
    } else {
      // the middle could be the answer, but maybe there is an earlier one on the left
      rechts = mitte;
    }
  }

  return links;
}

// returns all values with von <= ts < bis
// werte must be sorted by ts
export function ausschnitt(
  werte: Messwert[],
  von: number,
  bis: number,
): Messwert[] {
  const start = ersterIndexAb(werte, von);
  const ende = ersterIndexAb(werte, bis);
  return werte.slice(start, ende);
}
