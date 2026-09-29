import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEsl } from "@/lib/parse-esl";
import {
  ausschnitt,
  ersterIndexAb,
  findeLuecken,
  INTERVALL,
  zusammenfuehren,
} from "@/lib/timeseries";
import type { Messwert, Serie } from "@/lib/types";

const T = Date.UTC(2019, 2, 11, 23) / 1000; // any start time

// sdat series with values at T, T + 15 min, ...
function serie(erstellt: number, werte: number[], ab = 0): Serie {
  return {
    sensorId: "ID742",
    richtung: "bezug",
    art: "verbrauch",
    erstellt,
    werte: werte.map((wert, i) => ({ ts: T + (ab + i) * INTERVALL, wert })),
  };
}

describe("zusammenfuehren", () => {
  it("pro Zeitstempel gewinnt die Datei mit dem neusten Erstellungsdatum", () => {
    const alt = serie(100, [1, 1, 1]);
    const neu = serie(200, [2, 2], 1); // overlaps the last two values

    // order of the files must not matter
    const erwartet = [
      { ts: T, wert: 1 },
      { ts: T + INTERVALL, wert: 2 },
      { ts: T + 2 * INTERVALL, wert: 2 },
    ];
    expect(zusammenfuehren([alt, neu])).toEqual(erwartet);
    expect(zusammenfuehren([neu, alt])).toEqual(erwartet);
  });

  it("ältere Datei füllt Werte, die in der neueren fehlen", () => {
    // like a newer file where the parser dropped a condition 21 placeholder
    const alt = serie(100, [0.6, 0.9]);
    const neu: Serie = { ...serie(200, []), werte: [{ ts: T, wert: 0.3 }] };

    expect(zusammenfuehren([neu, alt])).toEqual([
      { ts: T, wert: 0.3 },
      { ts: T + INTERVALL, wert: 0.9 },
    ]);
  });

  it("sortiert chronologisch", () => {
    const spaeter = serie(100, [5], 4);
    const frueher = serie(100, [1], 0);

    const werte = zusammenfuehren([spaeter, frueher]);
    expect(werte.map((m) => m.ts)).toEqual([T, T + 4 * INTERVALL]);
  });

  it("ohne Serien gibt es keine Werte", () => {
    expect(zusammenfuehren([])).toEqual([]);
  });
});

// esl files overlap too, e.g. the reading of 1 february is in several monthly exports
describe("zusammenfuehren mit ESL-Dateien", () => {
  function bezugAus(xml: string, datei: string): Serie {
    const result = parseEsl(xml, datei);
    if (!result.ok) throw new Error(result.fehler.meldung);
    const bezug = result.serien.find((s) => s.richtung === "bezug");
    if (!bezug) throw new Error("kein Bezug");
    return bezug;
  }

  const januar = readFileSync("tests/fixtures/esl-2019-01.xml", "utf-8");
  const maerz = readFileSync("tests/fixtures/esl-2019-03.xml", "utf-8");

  const jan1 = Date.UTC(2018, 11, 31, 23) / 1000; // 2019-01-01 swiss time
  const feb1 = Date.UTC(2019, 0, 31, 23) / 1000;
  const mar1 = Date.UTC(2019, 1, 28, 23) / 1000;

  it("verschiedene Dateien ergeben eine sortierte Liste", () => {
    const werte = zusammenfuehren([
      bezugAus(maerz, "maerz.xml"),
      bezugAus(januar, "januar.xml"),
    ]);

    expect(werte).toEqual([
      { ts: jan1, wert: 19216.2 }, // 4755.3 + 14460.9
      { ts: feb1, wert: 21869.2 },
      { ts: mar1, wert: 23468.7 },
    ]);
  });

  it("doppelter Zeitpunkt: die neuere Datei gewinnt", () => {
    // a later export of the same file with a corrected february reading
    const korrigiert = maerz
      .replace(
        'created ="2019-03-14T09:34:00"',
        'created ="2019-03-20T09:00:00"',
      )
      .replace('value="5837.2000"', 'value="5837.5000"');

    const erwartet = [
      { ts: feb1, wert: 21869.5 }, // 5837.5 + 16032.0
      { ts: mar1, wert: 23468.7 },
    ];
    // order of the files must not matter
    expect(
      zusammenfuehren([
        bezugAus(maerz, "alt.xml"),
        bezugAus(korrigiert, "neu.xml"),
      ]),
    ).toEqual(erwartet);
    expect(
      zusammenfuehren([
        bezugAus(korrigiert, "neu.xml"),
        bezugAus(maerz, "alt.xml"),
      ]),
    ).toEqual(erwartet);
  });
});

describe("findeLuecken", () => {
  it("findet fehlende 15-Minuten-Werte", () => {
    const werte: Messwert[] = [0, 1, 4, 5, 8].map((i) => ({
      ts: T + i * INTERVALL,
      wert: 1,
    }));

    expect(findeLuecken(werte)).toEqual([
      { von: T + 2 * INTERVALL, bis: T + 4 * INTERVALL },
      { von: T + 6 * INTERVALL, bis: T + 8 * INTERVALL },
    ]);
  });

  it("lückenlose Reihe hat keine Lücken", () => {
    expect(findeLuecken(serie(0, [1, 2, 3, 4]).werte)).toEqual([]);
  });
});

describe("ausschnitt", () => {
  const werte = serie(0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).werte;

  it("von inklusive, bis exklusive", () => {
    const teil = ausschnitt(werte, T + 2 * INTERVALL, T + 5 * INTERVALL);
    expect(teil.map((m) => m.wert)).toEqual([2, 3, 4]);
  });

  it("Grenzen zwischen zwei Werten", () => {
    const teil = ausschnitt(
      werte,
      T + 2 * INTERVALL + 1,
      T + 5 * INTERVALL - 1,
    );
    expect(teil.map((m) => m.wert)).toEqual([3, 4]);
  });

  it("Bereich ausserhalb der Daten ist leer", () => {
    expect(ausschnitt(werte, T - 10 * INTERVALL, T)).toEqual([]);
    expect(ausschnitt(werte, T + 100 * INTERVALL, T + 200 * INTERVALL)).toEqual(
      [],
    );
  });

  it("binäre Suche stimmt mit linearer Suche überein", () => {
    // every time from before the first to after the last value, also between values
    for (let ts = T - INTERVALL; ts <= T + 11 * INTERVALL; ts += 300) {
      const linear = werte.findIndex((m) => m.ts >= ts);
      expect(ersterIndexAb(werte, ts)).toBe(
        linear === -1 ? werte.length : linear,
      );
    }
  });
});
