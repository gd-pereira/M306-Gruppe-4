export type SensorId = "ID742" | "ID735" | "ID26256" | "ID26257";
export type Richtung = "bezug" | "einspeisung";

/** ts = Unix seconds in UTC */
export interface Messwert {
  ts: number;
  wert: number; // kWh
}

export interface Serie {
  sensorId: string; // e.g. "ID742", only additional info
  richtung: Richtung;
  art: "verbrauch" | "zaehlerstand";
  werte: Messwert[]; // sorted by ts, no duplicates
}

export interface Fehler {
  datei: string;
  meldung: string;
}
