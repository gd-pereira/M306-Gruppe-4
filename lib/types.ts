// the client only wants these two sensors, all others are out of scope
export const SENSOREN = ["ID742", "ID735"] as const;
export type SensorId = (typeof SENSOREN)[number];

// bezug = power from the grid, einspeisung = solar power fed into the grid
export type Richtung = "bezug" | "einspeisung";

// one measurement, ts is in unix seconds
export interface Messwert {
  ts: number;
  wert: number; // kWh
}

// verbrauch = usage per 15 min (sdat), zaehlerstand = absolute meter reading (esl)
export interface Serie {
  sensorId: string; // e.g. "ID742", just extra info
  richtung: Richtung;
  art: "verbrauch" | "zaehlerstand";
  werte: Messwert[]; // sorted by ts
  erstellt?: number; // creation time of the file (unix seconds), newer files win on duplicates
}

// a file that could not be read and why
export interface Fehler {
  datei: string;
  meldung: string;
}
