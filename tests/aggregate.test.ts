import { describe, expect, it } from "vitest";
import { STUFEN, vorberechnen, zusammenfassen } from "@/lib/aggregate";
import { INTERVALL } from "@/lib/timeseries";
import type { Messwert } from "@/lib/types";
import { zurichZuUnix } from "@/lib/zeit";

// midnight swiss time of that day
function tag(datum: string): number {
  return zurichZuUnix(`${datum}T00:00:00`);
}

// a 15 min value from von (included) to bis (not included), all with the same value
function reihe(von: number, bis: number, wert = 1): Messwert[] {
  const werte: Messwert[] = [];
  for (let ts = von; ts < bis; ts += INTERVALL) {
    werte.push({ ts, wert });
  }
  return werte;
}

describe("zusammenfassen Verbrauch", () => {
  it("15 min bleibt gleich", () => {
    const werte = reihe(tag("2019-03-11"), tag("2019-03-12"), 0.5);
    expect(zusammenfassen(werte, "verbrauch", "15min")).toEqual(werte);
  });

  it("Stunde = Summe von 4 Werten", () => {
    const werte = reihe(tag("2019-03-11"), tag("2019-03-11") + 2 * 3600);
    expect(zusammenfassen(werte, "verbrauch", "stunde")).toEqual([
      { ts: tag("2019-03-11"), wert: 4 },
      { ts: tag("2019-03-11") + 3600, wert: 4 },
    ]);
  });

  it("normaler Tag hat 96 Werte", () => {
    const werte = reihe(tag("2019-03-11"), tag("2019-03-13"));
    expect(zusammenfassen(werte, "verbrauch", "tag")).toEqual([
      { ts: tag("2019-03-11"), wert: 96 },
      { ts: tag("2019-03-12"), wert: 96 },
    ]);
  });

  it("Zeitumstellung im März: der Tag hat nur 92 Werte", () => {
    const werte = reihe(tag("2019-03-30"), tag("2019-04-01"));
    expect(zusammenfassen(werte, "verbrauch", "tag")).toEqual([
      { ts: tag("2019-03-30"), wert: 96 },
      { ts: tag("2019-03-31"), wert: 92 },
    ]);
  });

  it("Zeitumstellung im Oktober: der Tag hat 100 Werte", () => {
    const werte = reihe(tag("2019-10-26"), tag("2019-10-28"));
    expect(zusammenfassen(werte, "verbrauch", "tag")).toEqual([
      { ts: tag("2019-10-26"), wert: 96 },
      { ts: tag("2019-10-27"), wert: 100 },
    ]);
  });

  it("Stunden bleiben bei der Zeitumstellung 4 Werte lang", () => {
    const werte = reihe(tag("2019-10-27"), tag("2019-10-28"));
    const stunden = zusammenfassen(werte, "verbrauch", "stunde");
    expect(stunden).toHaveLength(25);
    expect(stunden.every((s) => s.wert === 4)).toBe(true);
  });

  it("Woche beginnt am Montag", () => {
    // 2019-03-11 is a monday, 2019-03-24 a sunday
    const werte = reihe(tag("2019-03-11"), tag("2019-03-25"));
    expect(zusammenfassen(werte, "verbrauch", "woche")).toEqual([
      { ts: tag("2019-03-11"), wert: 7 * 96 },
      { ts: tag("2019-03-18"), wert: 7 * 96 },
    ]);
  });

  it("Woche mit Zeitumstellung hat 4 Werte weniger", () => {
    // 2019-03-25 is the monday after the change on sunday 2019-03-31
    const werte = reihe(tag("2019-03-25"), tag("2019-04-01"));
    expect(zusammenfassen(werte, "verbrauch", "woche")).toEqual([
      { ts: tag("2019-03-25"), wert: 7 * 96 - 4 },
    ]);
  });

  it("Monat über den Jahreswechsel", () => {
    const werte = reihe(tag("2018-12-01"), tag("2019-02-01"));
    expect(zusammenfassen(werte, "verbrauch", "monat")).toEqual([
      { ts: tag("2018-12-01"), wert: 31 * 96 },
      { ts: tag("2019-01-01"), wert: 31 * 96 },
    ]);
  });

  it("März 2019 hat wegen der Zeitumstellung 4 Werte weniger", () => {
    const werte = reihe(tag("2019-03-01"), tag("2019-04-01"));
    expect(zusammenfassen(werte, "verbrauch", "monat")).toEqual([
      { ts: tag("2019-03-01"), wert: 31 * 96 - 4 },
    ]);
  });

  it("Lücken: Abschnitte ohne Werte fehlen einfach", () => {
    const werte = [
      ...reihe(tag("2019-03-11"), tag("2019-03-12")),
      ...reihe(tag("2019-03-14"), tag("2019-03-15")),
    ];
    const tage = zusammenfassen(werte, "verbrauch", "tag");
    expect(tage.map((t) => t.ts)).toEqual([
      tag("2019-03-11"),
      tag("2019-03-14"),
    ]);
  });

  it("rundet Kommafehler weg", () => {
    const werte = reihe(
      tag("2019-03-11"),
      tag("2019-03-11") + 3 * INTERVALL,
      0.1,
    );
    expect(zusammenfassen(werte, "verbrauch", "stunde")).toEqual([
      { ts: tag("2019-03-11"), wert: 0.3 },
    ]);
  });

  it("ohne Werte gibt es kein Ergebnis", () => {
    expect(zusammenfassen([], "verbrauch", "tag")).toEqual([]);
  });
});

describe("zusammenfassen Zählerstand", () => {
  // a reading belongs to the end of its 15 min interval, like in berechneZaehlerstand
  function staende(von: number, bis: number): Messwert[] {
    return reihe(von, bis).map((m, i) => ({
      ts: m.ts + INTERVALL,
      wert: 1000 + i + 1,
    }));
  }

  it("nimmt den letzten Wert, nicht die Summe", () => {
    const werte = staende(tag("2019-03-11"), tag("2019-03-11") + 3600);
    expect(zusammenfassen(werte, "zaehlerstand", "stunde")).toEqual([
      { ts: tag("2019-03-11"), wert: 1004 },
    ]);
  });

  it("der Stand um 00:00 gehört zum Tag davor", () => {
    const werte = staende(tag("2019-03-11"), tag("2019-03-13"));
    expect(zusammenfassen(werte, "zaehlerstand", "tag")).toEqual([
      { ts: tag("2019-03-11"), wert: 1096 },
      { ts: tag("2019-03-12"), wert: 1192 },
    ]);
  });

  it("Zeitumstellung: letzter Stand des Tages mit 92 bzw. 100 Werten", () => {
    const maerz = staende(tag("2019-03-31"), tag("2019-04-01"));
    expect(zusammenfassen(maerz, "zaehlerstand", "tag")).toEqual([
      { ts: tag("2019-03-31"), wert: 1092 },
    ]);

    const oktober = staende(tag("2019-10-27"), tag("2019-10-28"));
    expect(zusammenfassen(oktober, "zaehlerstand", "tag")).toEqual([
      { ts: tag("2019-10-27"), wert: 1100 },
    ]);
  });

  it("ESL-Stand vom 1. Februar ist der Endstand vom Januar", () => {
    const esl: Messwert[] = [
      { ts: tag("2019-01-01"), wert: 19216.2 },
      { ts: tag("2019-02-01"), wert: 21869.2 },
      { ts: tag("2019-03-01"), wert: 23468.7 },
    ];
    expect(zusammenfassen(esl, "zaehlerstand", "monat")).toEqual([
      { ts: tag("2018-12-01"), wert: 19216.2 },
      { ts: tag("2019-01-01"), wert: 21869.2 },
      { ts: tag("2019-02-01"), wert: 23468.7 },
    ]);
  });
});

describe("vorberechnen", () => {
  it("liefert alle Zoomstufen", () => {
    const werte = reihe(tag("2019-03-01"), tag("2019-04-01"));
    const stufen = vorberechnen(werte, "verbrauch");

    expect(Object.keys(stufen)).toEqual([...STUFEN]);
    expect(stufen["15min"]).toHaveLength(31 * 96 - 4);
    expect(stufen.stunde).toHaveLength(31 * 24 - 1);
    expect(stufen.tag).toHaveLength(31);
    expect(stufen.monat).toEqual([
      { ts: tag("2019-03-01"), wert: 31 * 96 - 4 },
    ]);
  });

  it("die Summe bleibt auf jeder Stufe gleich", () => {
    const werte = reihe(tag("2019-01-01"), tag("2019-12-31"), 0.25);
    const stufen = vorberechnen(werte, "verbrauch");
    const summe = (liste: Messwert[]) => liste.reduce((s, m) => s + m.wert, 0);

    for (const stufe of STUFEN) {
      expect(summe(stufen[stufe])).toBeCloseTo(werte.length * 0.25, 6);
    }
  });
});
