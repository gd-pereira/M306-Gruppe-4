// consumption = power drawn from the grid, feedIn = solar power fed into the grid
export type Direction = "consumption" | "feedIn";

// the client only wants these two sensors, all others are out of scope
export const SENSOR_IDS = {
  consumption: "ID742",
  feedIn: "ID735",
} as const satisfies Record<Direction, string>;
export type SensorId = (typeof SENSOR_IDS)[Direction];

// one measurement, ts is in unix seconds
export interface DataPoint {
  ts: number;
  value: number; // kWh
}

// usage = energy per 15 min (sdat), meterReading = absolute meter reading (esl)
export interface Series {
  sensorId: string; // e.g. "ID742", just extra info
  direction: Direction;
  kind: "usage" | "meterReading";
  points: DataPoint[]; // sorted by ts
  createdAt?: number; // creation time of the file (unix seconds), newer files win on duplicates
}

// a file that could not be read and why
export interface FileError {
  file: string;
  message: string;
}

// a valid file from a sensor the client wants us to ignore, e.g. ID26256
export interface IgnoredFile {
  file: string;
  sensorId: string;
}
