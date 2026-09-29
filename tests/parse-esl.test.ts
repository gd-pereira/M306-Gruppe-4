import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEsl } from "@/lib/parse-esl";
import type { Richtung, Serie } from "@/lib/types";

function parseFixture(name: string) {
  return parseEsl(readFileSync(`tests/fixtures/${name}`, "utf-8"), name);
}

function findSerie(serien: Serie[], richtung: Richtung) {
  return serien.find((s) => s.richtung === richtung);
}

describe("parseEsl", () => {
  it("liest alle TimePeriods und summiert Hoch- und Niedertarif", () => {
    const result = parseFixture("esl-2019-03.xml");
    if (!result.ok) throw new Error(result.fehler.meldung);

    // end="2019-02-01T00:00:00" and "2019-03-01T00:00:00" in swiss winter time (UTC+1)
    const feb = Date.UTC(2019, 0, 31, 23) / 1000;
    const maerz = Date.UTC(2019, 1, 28, 23) / 1000;

    // sums calculated by hand from the file
    const bezug = findSerie(result.serien, "bezug");
    expect(bezug?.sensorId).toBe("ID742");
    expect(bezug?.art).toBe("zaehlerstand");
    expect(bezug?.werte).toEqual([
      { ts: feb, wert: 21869.2 }, // 5837.2 + 16032.0
      { ts: maerz, wert: 23468.7 }, // 6339.7 + 17129.0
    ]);

    const einspeisung = findSerie(result.serien, "einspeisung");
    expect(einspeisung?.sensorId).toBe("ID735");
    expect(einspeisung?.werte).toEqual([
      { ts: feb, wert: 11803.3 }, // 8258.8 + 3544.5
      { ts: maerz, wert: 11959.7 }, // 8348.4 + 3611.3
    ]);
  });

  it("liest das Erstellungsdatum der Datei", () => {
    const result = parseFixture("esl-2019-03.xml");
    if (!result.ok) throw new Error(result.fehler.meldung);

    // created ="2019-03-14T09:34:00" in swiss winter time (UTC+1)
    const erstellt = Date.UTC(2019, 2, 14, 8, 34) / 1000;
    for (const serie of result.serien) {
      expect(serie.erstellt).toBe(erstellt);
    }
  });

  it("überspringt Zeitpunkte mit fehlenden OBIS-Codes", () => {
    const result = parseFixture("esl-teilweise.xml");
    if (!result.ok) throw new Error(result.fehler.meldung);

    // may and june only have bezug, july has both (summer time, UTC+2)
    const mai = Date.UTC(2020, 3, 30, 22) / 1000;
    const juni = Date.UTC(2020, 4, 31, 22) / 1000;
    const juli = Date.UTC(2020, 5, 30, 22) / 1000;

    expect(findSerie(result.serien, "bezug")?.werte).toEqual([
      { ts: mai, wert: 37736.4 }, // 12095.0 + 25641.4
      { ts: juni, wert: 38406.2 }, // 12283.1 + 26123.1
      { ts: juli, wert: 38975.5 }, // 12460.1 + 26515.4
    ]);
    expect(findSerie(result.serien, "einspeisung")?.werte).toEqual([
      { ts: juli, wert: 18502.7 }, // 12269.7 + 6233.0
    ]);
  });

  it("Datei nur mit Wasserzähler ergibt keine Serien", () => {
    const result = parseFixture("esl-wasser.xml");

    expect(result).toEqual({ ok: true, serien: [] });
  });

  it("kaputte Datei ergibt Fehler statt Absturz", () => {
    const result = parseFixture("sdat-kaputt.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fehler.datei).toBe("sdat-kaputt.xml");
  });

  it("SDAT-Datei ist keine ESL-Datei", () => {
    const result = parseFixture("sdat-ID742.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fehler.meldung).toBe("Keine ESL-Datei");
  });
});
