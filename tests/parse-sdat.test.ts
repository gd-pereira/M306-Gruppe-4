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

    // every value should be exactly 15 min (900 s) after the one before
    for (let i = 1; i < serie.werte.length; i++) {
      expect(serie.werte[i].ts - serie.werte[i - 1].ts).toBe(900);
    }
  });

  it("ID742: Zeitstempel und Werte stimmen", () => {
    const result = parseFixture("sdat-ID742.xml");
    if (!result.ok) throw new Error("ID742 sollte gelesen werden");

    // values taken by hand from the fixture file
    const start = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000; // 2019-03-11T23:00:00Z
    const { werte } = result.serie;
    expect(werte[0]).toEqual({ ts: start, wert: 3 });
    expect(werte[1]).toEqual({ ts: start + 900, wert: 2.7 });
    expect(werte[95]).toEqual({ ts: start + 95 * 900, wert: 0.6 });
  });

  it("liest das Erstellungsdatum der Datei", () => {
    const result = parseFixture("sdat-ID742.xml");
    if (!result.ok) throw new Error("Datei sollte gelesen werden");

    // <rsm:Creation>2019-03-13T08:31:00Z</rsm:Creation>
    expect(result.serie.erstellt).toBe(Date.UTC(2019, 2, 13, 8, 31) / 1000);
  });

  // condition 21 = placeholder 0, the client wants the real value from the newer file instead
  describe("Platzhalter (Condition 21)", () => {
    const xml = readFileSync("tests/fixtures/sdat-ID742.xml", "utf-8");
    const platzhalter = "</rsm:Volume><rsm:Condition>21</rsm:Condition>";

    it("werden übersprungen", () => {
      // only the first observation becomes a placeholder
      const result = parseSdat(
        xml.replace("</rsm:Volume>", platzhalter),
        "platzhalter.xml",
      );
      if (!result.ok) throw new Error("Datei sollte gelesen werden");

      const start = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000;
      expect(result.serie.werte).toHaveLength(95);
      expect(result.serie.werte[0]).toEqual({ ts: start + 900, wert: 2.7 });
    });

    it("Datei nur mit Platzhaltern ist gültig, aber leer", () => {
      const result = parseSdat(
        xml.replaceAll("</rsm:Volume>", platzhalter),
        "nur-platzhalter.xml",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.serie.werte).toEqual([]);
    });

    it("andere Conditions (z.B. 56 = Ersatzwert) sind echte Werte", () => {
      const result = parseSdat(
        xml.replace(
          "</rsm:Volume>",
          "</rsm:Volume><rsm:Condition>56</rsm:Condition>",
        ),
        "ersatzwert.xml",
      );
      if (!result.ok) throw new Error("Datei sollte gelesen werden");

      expect(result.serie.werte).toHaveLength(96);
    });
  });

  it("kaputte Datei ergibt Fehler statt Absturz", () => {
    const result = parseFixture("sdat-kaputt.xml");

    expect(result.ok).toBe(false);
    if (result.ok || !("fehler" in result)) throw new Error("Fehler erwartet");
    expect(result.fehler.datei).toBe("sdat-kaputt.xml");
    expect(result.fehler.meldung).toContain("Ungültiges XML");
  });

  // the client only wants ID742 and ID735, all others are ignored (not an error)
  it.each(["ID26256", "ID26257", "ID26263"])("%s wird ignoriert", (id) => {
    const result = parseFixture(`sdat-${id}.xml`);

    expect(result).toEqual({
      ok: false,
      ignoriert: { datei: `sdat-${id}.xml`, sensorId: id },
    });
  });

  it("DocumentID ohne Sensor-ID ergibt Fehler", () => {
    const xml = readFileSync("tests/fixtures/sdat-ID742.xml", "utf-8").replace(
      /_ID742</,
      "<",
    );
    const result = parseSdat(xml, "ohne-id.xml");

    expect(result).toEqual({
      ok: false,
      fehler: { datei: "ohne-id.xml", meldung: "Sensor-ID fehlt in DocumentID" },
    });
  });

  it("ESL-Datei ist keine SDAT-Datei", () => {
    const result = parseFixture("esl-2019-01.xml");

    expect(result.ok).toBe(false);
  });
});
