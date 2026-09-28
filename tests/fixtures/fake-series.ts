import type { Messwert, Serie } from "@/lib/types";

// 2019-03-11T23:00:00Z = Mitternacht Schweizer Zeit
const START = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000;
const STEP = 15 * 60;
const COUNT = 96;

const round = (n: number) => Math.round(n * 1000) / 1000;

function verbrauch(fn: (stunde: number) => number): Messwert[] {
  return Array.from({ length: COUNT }, (_, i) => ({
    ts: START + i * STEP,
    wert: round(fn(i / 4)),
  }));
}

function zaehlerstand(werte: Messwert[], startwert: number): Messwert[] {
  let summe = startwert;
  return werte.map((m) => {
    summe += m.wert;
    return { ts: m.ts, wert: round(summe) };
  });
}

// Bezug: Grundlast plus Spitzen am Morgen und Abend
const bezug = verbrauch(
  (h) => 0.6 + (h >= 6 && h < 9 ? 2 : 0) + (h >= 17 && h < 21 ? 3 : 0),
);

// Einspeisung: Sonnenkurve von 6 bis 18 Uhr
const einspeisung = verbrauch(
  (h) => Math.max(0, Math.sin((Math.PI * (h - 6)) / 12)) * 4,
);

// Startwerte aus ESL Januar 2019: 1.8.1 + 1.8.2 bzw. 2.8.1 + 2.8.2
export const fakeSeries: Serie[] = [
  { sensorId: "ID742", richtung: "bezug", art: "verbrauch", werte: bezug },
  {
    sensorId: "ID742",
    richtung: "bezug",
    art: "zaehlerstand",
    werte: zaehlerstand(bezug, 19216.2),
  },
  {
    sensorId: "ID735",
    richtung: "einspeisung",
    art: "verbrauch",
    werte: einspeisung,
  },
  {
    sensorId: "ID735",
    richtung: "einspeisung",
    art: "zaehlerstand",
    werte: zaehlerstand(einspeisung, 11801.2),
  },
];
