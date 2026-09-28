import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSdat } from "@/lib/parse-sdat";
import type { Richtung } from "@/lib/types";

function parseFixture(name: string) {
  return parseSdat(readFileSync(`tests/fixtures/${name}`, "utf-8"), name);
}

describe("parseSdat", () => {
  const varianten: [string, Richtung][] = [
    ["ID742", "bezug"],
    ["ID735", "einspeisung"],
    ["ID26256", "bezug"],
    ["ID26257", "einspeisung"],
  ];

  it.each(varianten)("%s wird als %s gelesen", (id, richtung) => {
    const result = parseFixture(`sdat-${id}.xml`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { serie } = result;
    expect(serie.sensorId).toBe(id);
    expect(serie.richtung).toBe(richtung);
    expect(serie.art).toBe("verbrauch");
    expect(serie.werte).toHaveLength(96);
    for (let i = 1; i < serie.werte.length; i++) {
      expect(serie.werte[i].ts - serie.werte[i - 1].ts).toBe(900);
    }
  });

  it("ID742: Zeitstempel und Werte stimmen", () => {
    const result = parseFixture("sdat-ID742.xml");
    if (!result.ok) throw new Error(result.fehler.meldung);

    const start = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000; // 2019-03-11T23:00:00Z
    const { werte } = result.serie;
    expect(werte[0]).toEqual({ ts: start, wert: 3 });
    expect(werte[1]).toEqual({ ts: start + 900, wert: 2.7 });
    expect(werte[95]).toEqual({ ts: start + 95 * 900, wert: 0.6 });
  });

  it("kaputte Datei ergibt Fehler statt Absturz", () => {
    const result = parseFixture("sdat-kaputt.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fehler.datei).toBe("sdat-kaputt.xml");
    expect(result.fehler.meldung).toContain("Ungültiges XML");
  });

  it("ID26263 ohne 15-Minuten-Auflösung ergibt Fehler", () => {
    const result = parseFixture("sdat-ID26263.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fehler.meldung).toContain("15-Minuten");
  });

  it("ESL-Datei ist keine SDAT-Datei", () => {
    const result = parseFixture("esl-2019-01.xml");

    expect(result.ok).toBe(false);
  });
});
