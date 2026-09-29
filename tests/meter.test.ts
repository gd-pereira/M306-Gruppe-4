import { describe, expect, it } from "vitest";
import { berechneZaehlerstand, vergleicheMitEsl } from "@/lib/meter";
import { INTERVALL } from "@/lib/timeseries";
import type { Messwert } from "@/lib/types";

const T = Date.UTC(2019, 1, 28, 23) / 1000; // 2019-03-01 00:00 swiss time

// 15 min usage values starting at T
function verbrauch(werte: number[]): Messwert[] {
  return werte.map((wert, i) => ({ ts: T + i * INTERVALL, wert }));
}

// time after n intervals
function nach(n: number): number {
  return T + n * INTERVALL;
}

describe("berechneZaehlerstand", () => {
  it("bekannter Start + Werte = erwarteter Endstand", () => {
    const esl = [{ ts: T, wert: 1000 }];

    expect(berechneZaehlerstand(verbrauch([1, 2, 3, 4]), esl)).toEqual([
      { ts: nach(1), wert: 1001 },
      { ts: nach(2), wert: 1003 },
      { ts: nach(3), wert: 1006 },
      { ts: nach(4), wert: 1010 },
    ]);
  });

  it("rechnet vom ESL-Wert rückwärts, wenn dieser später liegt", () => {
    // like 2018: sdat values before the first esl reading
    const esl = [{ ts: nach(4), wert: 1010 }];

    expect(berechneZaehlerstand(verbrauch([1, 2, 3, 4]), esl)).toEqual([
      { ts: nach(1), wert: 1001 },
      { ts: nach(2), wert: 1003 },
      { ts: nach(3), wert: 1006 },
      { ts: nach(4), wert: 1010 },
    ]);
  });

  it("nimmt jeweils den nächstgelegenen ESL-Wert", () => {
    // sdat says +8, esl says +1000, so both halves have their own reference
    const esl = [
      { ts: T, wert: 1000 },
      { ts: nach(8), wert: 2000 },
    ];
    const staende = berechneZaehlerstand(
      verbrauch([1, 1, 1, 1, 1, 1, 1, 1]),
      esl,
    );

    // up to the middle (tie goes to the earlier one) forward from 1000, then backward from 2000
    expect(staende.map((m) => m.wert)).toEqual([
      1001, 1002, 1003, 1004, 1997, 1998, 1999, 2000,
    ]);
  });

  it("Lücken zählen als kein Verbrauch", () => {
    const esl = [{ ts: T, wert: 1000 }];
    const werte = [
      { ts: nach(0), wert: 1 },
      { ts: nach(3), wert: 1 }, // 2 values missing in between
    ];

    expect(berechneZaehlerstand(werte, esl)).toEqual([
      { ts: nach(1), wert: 1001 },
      { ts: nach(4), wert: 1002 },
    ]);
  });

  it("ohne ESL-Wert gibt es keinen Zählerstand", () => {
    expect(berechneZaehlerstand(verbrauch([1, 2, 3]), [])).toEqual([]);
  });

  it("keine Rundungsfehler wie 19216.199999", () => {
    const esl = [{ ts: T, wert: 19216.1 }];
    const staende = berechneZaehlerstand(verbrauch([0.1, 0.2]), esl);

    expect(staende.map((m) => m.wert)).toEqual([19216.2, 19216.4]);
  });
});

describe("vergleicheMitEsl", () => {
  const esl = (differenz: number) => [
    { ts: T, wert: 1000 },
    { ts: nach(4), wert: 1000 + differenz },
  ];
  const werte = verbrauch([1, 2, 3, 4]); // sum 10

  it("liefert SDAT-Summe und ESL-Differenz pro Zeitraum", () => {
    expect(vergleicheMitEsl(werte, esl(10))).toEqual([
      { von: T, bis: nach(4), sdat: 10, esl: 10, vollstaendig: true },
    ]);
  });

  it("Faktor 3 wie in den Testdaten wird nicht markiert", () => {
    // sdat 30 vs esl 10, the client said to keep the values as they are
    const [vergleich] = vergleicheMitEsl(verbrauch([3, 6, 9, 12]), esl(10));

    expect(vergleich.sdat).toBe(30);
    expect(vergleich.vollstaendig).toBe(true);
  });

  it("merkt, wenn SDAT-Werte fehlen", () => {
    // the 3rd value is missing, like the gaps in 02/2020, 06/2020, 02/2021 and 03/2021
    const mitLuecke = [werte[0], werte[1], werte[3]];
    const [vergleich] = vergleicheMitEsl(mitLuecke, esl(10));

    expect(vergleich.sdat).toBe(7);
    expect(vergleich.vollstaendig).toBe(false);
  });

  it("Zeitraum, in dem die SDAT-Daten enden, wird übersprungen", () => {
    // like 09/2021: sdat stops on 06.09., that is not a gap
    expect(vergleicheMitEsl(werte.slice(0, 3), esl(10))).toEqual([]);
  });

  it("Zeiträume ohne SDAT-Werte werden übersprungen", () => {
    // like after september 2021, only esl
    const spaeter = [
      { ts: nach(100), wert: 2000 },
      { ts: nach(200), wert: 2100 },
    ];

    expect(vergleicheMitEsl(werte, spaeter)).toEqual([]);
  });
});
