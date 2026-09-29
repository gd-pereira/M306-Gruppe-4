import { describe, expect, it } from "vitest";
import { zusammenfuehren } from "@/lib/duplikate";
import type { Messwert, Richtung, Serie } from "@/lib/types";

function sdat(richtung: Richtung, werte: Messwert[]): Serie {
  const sensorId = richtung === "bezug" ? "ID742" : "ID735";
  return { sensorId, richtung, art: "verbrauch", werte };
}

describe("zusammenfuehren", () => {
  it("ohne Überschneidung werden die Werte nur aneinandergehängt", () => {
    const { serien, duplikate } = zusammenfuehren([
      sdat("bezug", [{ ts: 1800, wert: 0.9 }]),
      sdat("bezug", [
        { ts: 0, wert: 0.3 },
        { ts: 900, wert: 0.6 },
      ]),
    ]);

    expect(serien).toHaveLength(1);
    expect(serien[0].werte).toEqual([
      { ts: 0, wert: 0.3 },
      { ts: 900, wert: 0.6 },
      { ts: 1800, wert: 0.9 },
    ]);
    expect(duplikate).toEqual({ identisch: 0, ersetzt: 0 });
  });

  it("echter Wert gewinnt gegen 0, egal in welcher Reihenfolge", () => {
    const { serien, duplikate } = zusammenfuehren([
      sdat("bezug", [
        { ts: 0, wert: 0 },
        { ts: 900, wert: 1.2 },
      ]),
      sdat("bezug", [
        { ts: 0, wert: 2.4 },
        { ts: 900, wert: 0 },
      ]),
    ]);

    expect(serien[0].werte).toEqual([
      { ts: 0, wert: 2.4 },
      { ts: 900, wert: 1.2 },
    ]);
    expect(duplikate).toEqual({ identisch: 0, ersetzt: 2 });
  });

  it("gleiche Werte zählen als identische Duplikate", () => {
    const { serien, duplikate } = zusammenfuehren([
      sdat("bezug", [{ ts: 0, wert: 0.3 }]),
      sdat("bezug", [{ ts: 0, wert: 0.3 }]),
      sdat("bezug", [{ ts: 0, wert: 0 }]),
    ]);

    expect(serien[0].werte).toEqual([{ ts: 0, wert: 0.3 }]);
    expect(duplikate).toEqual({ identisch: 1, ersetzt: 1 });
  });

  it("Bezug und Einspeisung werden nicht vermischt", () => {
    const { serien, duplikate } = zusammenfuehren([
      sdat("bezug", [{ ts: 0, wert: 0.3 }]),
      sdat("einspeisung", [{ ts: 0, wert: 1.5 }]),
    ]);

    expect(serien).toHaveLength(2);
    expect(serien.find((s) => s.richtung === "bezug")?.werte).toEqual([
      { ts: 0, wert: 0.3 },
    ]);
    expect(serien.find((s) => s.richtung === "einspeisung")?.werte).toEqual([
      { ts: 0, wert: 1.5 },
    ]);
    expect(duplikate).toEqual({ identisch: 0, ersetzt: 0 });
  });
});
