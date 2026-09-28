import type { Messwert, Serie } from "@/lib/types";

// fake data so the ui can build charts before the real parser is wired up
// one day in 15 min steps

const START = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000; // midnight swiss time
const STEP = 15 * 60; // 15 min in seconds
const COUNT = 96; // 24 h * 4

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// builds 96 usage values, getValue gets the hour of the day (0 to 23.75)
function makeUsage(getValue: (hour: number) => number): Messwert[] {
  const werte: Messwert[] = [];
  for (let i = 0; i < COUNT; i++) {
    werte.push({ ts: START + i * STEP, wert: round(getValue(i / 4)) });
  }
  return werte;
}

// meter reading = start value + everything used so far
function makeReadings(usage: Messwert[], startValue: number): Messwert[] {
  let total = startValue;
  const werte: Messwert[] = [];
  for (const m of usage) {
    total += m.wert;
    werte.push({ ts: m.ts, wert: round(total) });
  }
  return werte;
}

// bezug: base load, more in the morning (6-9) and evening (17-21)
const bezug = makeUsage((hour) => {
  let value = 0.6;
  if (hour >= 6 && hour < 9) value += 2;
  if (hour >= 17 && hour < 21) value += 3;
  return value;
});

// einspeisung: sun curve between 6 and 18, nothing at night
const einspeisung = makeUsage((hour) => {
  const sun = Math.sin((Math.PI * (hour - 6)) / 12);
  return Math.max(0, sun) * 4;
});

// start values from the esl file of january 2019 (1.8.1 + 1.8.2 and 2.8.1 + 2.8.2)
export const fakeSeries: Serie[] = [
  { sensorId: "ID742", richtung: "bezug", art: "verbrauch", werte: bezug },
  {
    sensorId: "ID742",
    richtung: "bezug",
    art: "zaehlerstand",
    werte: makeReadings(bezug, 19216.2),
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
    werte: makeReadings(einspeisung, 11801.2),
  },
];
