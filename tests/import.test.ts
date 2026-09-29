import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auswerten, dateiEinlesen, neueSammlung } from "@/lib/import";

// reads the fixture files like the worker does and returns the result
function importieren(namen: string[]) {
  const sammlung = neueSammlung();
  for (const name of namen) {
    dateiEinlesen(
      sammlung,
      name,
      readFileSync(`tests/fixtures/${name}`, "utf-8"),
    );
  }
  return auswerten(sammlung);
}

describe("Import", () => {
  it("sortiert die Dateien nach SDAT, ESL, ignoriert und Fehler", () => {
    const ergebnis = importieren([
      "sdat-ID742.xml",
      "sdat-ID735.xml",
      "esl-2019-01.xml",
      "esl-2019-03.xml",
      "sdat-ID26256.xml",
      "sdat-kaputt.xml",
    ]);

    expect(ergebnis.statistik).toEqual({
      sdatDateien: 2,
      eslDateien: 2,
      platzhalter: 0,
      duplikate: 0,
    });
    expect(ergebnis.ignoriert).toEqual([
      { datei: "sdat-ID26256.xml", sensorId: "ID26256" },
    ]);
    expect(ergebnis.fehler).toHaveLength(1);
    expect(ergebnis.fehler[0].datei).toBe("sdat-kaputt.xml");
    expect(ergebnis.bezug.anzahlWerte).toBe(96);
    expect(ergebnis.einspeisung.anzahlWerte).toBe(96);
  });

  it("dieselbe Datei zweimal ergibt 96 Duplikate", () => {
    const ergebnis = importieren(["sdat-ID742.xml", "sdat-ID742.xml"]);

    expect(ergebnis.statistik.duplikate).toBe(96);
    expect(ergebnis.bezug.anzahlWerte).toBe(96);
  });

  it("Zählerstand startet beim nächsten ESL-Wert", () => {
    const ergebnis = importieren([
      "sdat-ID742.xml",
      "esl-2019-01.xml",
      "esl-2019-03.xml",
    ]);
    const { esl, zaehlerstand } = ergebnis.bezug;

    // the sdat day is 12.03.2019, the closest esl reading is 01.03.2019 (the last one)
    // the first 15 min value of the day is 3 kWh
    expect(esl).toHaveLength(3);
    expect(zaehlerstand["15min"]).toHaveLength(96);
    expect(zaehlerstand["15min"][0].wert).toBe(esl[2].wert + 3);
  });

  it("alle Zoomstufen sind vorberechnet", () => {
    const ergebnis = importieren(["sdat-ID742.xml"]);
    const { verbrauch } = ergebnis.bezug;

    expect(verbrauch["15min"]).toHaveLength(96);
    expect(verbrauch.stunde).toHaveLength(24);
    expect(verbrauch.tag).toHaveLength(1);
  });

  it("unbekannte Datei ergibt Fehler statt Absturz", () => {
    const sammlung = neueSammlung();
    dateiEinlesen(sammlung, "notizen.txt", "hallo");

    expect(sammlung.fehler).toHaveLength(1);
    expect(sammlung.fehler[0].datei).toBe("notizen.txt");
  });

  it("ohne Dateien gibt es ein leeres Ergebnis", () => {
    const ergebnis = importieren([]);

    expect(ergebnis.statistik).toEqual({
      sdatDateien: 0,
      eslDateien: 0,
      platzhalter: 0,
      duplikate: 0,
    });
    expect(ergebnis.bezug.zaehlerstand["15min"]).toEqual([]);
  });
});
