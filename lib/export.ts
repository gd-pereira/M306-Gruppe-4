import type { ImportResult } from "@/lib/import";
import { roundKwh } from "@/lib/math";
import { firstIndexFrom, INTERVAL, type Gap } from "@/lib/timeseries";
import {
  SENSOR_IDS,
  type DataPoint,
  type Direction,
  type SensorId,
} from "@/lib/types";

// csv and json export of the meter readings, formats like in the project description:
// csv: one file per sensor, "timestamp,value", unix seconds (utc), absolute meter reading
// json: [{ "sensorId": "ID742", "data": [{ "ts": "1503495302", "value": 82.03 }] }]

export type ExportFormat = "csv" | "json";

// the meter readings of one sensor as they go into the file
export interface ExportSeries {
  sensorId: SensorId;
  readings: DataPoint[]; // ts = end of the 15 min interval, sorted, nothing in the gaps
  gaps: Gap[]; // time ranges without sdat values, there are no readings in them
}

// what to export: which sensors, which format and the time range
// a reading belongs to the end of its interval, so from < ts <= to
export interface ExportRequest {
  format: ExportFormat;
  series: ExportSeries[];
  from: number;
  to: number;
}

export interface ExportSummary {
  values: number; // all sensors together
  bytes: number; // exact size of the file
  // first and last reading of every sensor in the range, null if there is none
  readings: Partial<Record<SensorId, { first: number; last: number } | null>>;
  gaps: Gap[]; // gaps inside the range, cut to the range
}

// excel on swiss and german windows expects ";" and puts a plain comma csv into one column,
// this first line tells excel the separator (decided by the team, tested with excel 16 de-CH)
const CSV_SEPARATOR_HINT = "sep=,";
const CSV_HEADER = "timestamp,value";

const DIRECTIONS: Direction[] = ["consumption", "feedIn"];

// the 15 min readings of both sensors from the import
// meterReading["15min"] has the start of the interval as ts (like all zoom levels),
// the export wants the end of the interval, so we move it by 15 min
export function exportSeries(
  result: ImportResult,
): Record<SensorId, ExportSeries> {
  const series = {} as Record<SensorId, ExportSeries>;
  for (const direction of DIRECTIONS) {
    const data = result[direction];
    const sensorId = SENSOR_IDS[direction];
    series[sensorId] = {
      sensorId,
      readings: data.meterReading["15min"].map((point) => ({
        ts: point.ts + INTERVAL,
        value: point.value,
      })),
      gaps: data.gaps,
    };
  }
  return series;
}

// readings with from < ts <= to
export function readingsInRange(
  readings: DataPoint[],
  from: number,
  to: number,
): DataPoint[] {
  return readings.slice(
    firstIndexFrom(readings, from + 1),
    firstIndexFrom(readings, to + 1),
  );
}

// the gaps that overlap the range, cut to the range
export function gapsInRange(gaps: Gap[], from: number, to: number): Gap[] {
  return gaps
    .filter((gap) => gap.end > from && gap.start < to)
    .map((gap) => ({
      start: Math.max(gap.start, from),
      end: Math.min(gap.end, to),
    }));
}

// up to 4 decimals like everywhere in lib (roundKwh), without trailing zeros: 3569.9573, 100.25, 100
function formatValue(value: number): string {
  return String(roundKwh(value));
}

function csvLine(point: DataPoint): string {
  return `${point.ts},${formatValue(point.value)}`;
}

// ts is a string in the project description, value a number
export function jsonValue(point: DataPoint): string {
  return `{"ts":"${point.ts}","value":${formatValue(point.value)}}`;
}

function jsonHead(sensorId: SensorId): string {
  return `{"sensorId":"${sensorId}","data":[`;
}

// csv is named after the sensor, json has both sensors in one file
export function fileName(format: ExportFormat, sensorId: SensorId): string {
  return format === "csv" ? `${sensorId}.csv` : "zaehlerstaende.json";
}

function mimeType(format: ExportFormat): string {
  return format === "csv" ? "text/csv;charset=utf-8" : "application/json";
}

// the csv lines without line breaks: separator hint, header, then the readings
// only the first series is used, a csv file has one sensor
export function* csvLines(request: ExportRequest): Generator<string> {
  yield CSV_SEPARATOR_HINT;
  yield CSV_HEADER;
  const [series] = request.series;
  if (!series) return;
  for (const point of readingsInRange(
    series.readings,
    request.from,
    request.to,
  )) {
    yield csvLine(point);
  }
}

// the whole file in small pieces: csv line by line, json minified in one line
export function* filePieces(request: ExportRequest): Generator<string> {
  if (request.format === "csv") {
    for (const line of csvLines(request)) yield `${line}\n`;
    return;
  }

  yield "[";
  for (const [index, series] of request.series.entries()) {
    yield `${index > 0 ? "," : ""}${jsonHead(series.sensorId)}`;
    const points = readingsInRange(series.readings, request.from, request.to);
    for (const [i, point] of points.entries()) {
      yield `${i > 0 ? "," : ""}${jsonValue(point)}`;
    }
    yield "]}";
  }
  yield "]\n";
}

// the whole file as text, e.g. for the http post or tests
export function exportText(request: ExportRequest): string {
  return [...filePieces(request)].join("");
}

// the whole file as a blob, built in chunks so the page stays responsive
export async function buildFile(request: ExportRequest): Promise<Blob> {
  const parts: string[] = [];
  let chunk: string[] = [];
  for (const piece of filePieces(request)) {
    chunk.push(piece);
    if (chunk.length === 20_000) {
      parts.push(chunk.join(""));
      chunk = [];
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  if (chunk.length > 0) parts.push(chunk.join(""));
  return new Blob(parts, { type: mimeType(request.format) });
}

// number of values, file size, first and last reading and gaps, without building the file
export function exportSummary(request: ExportRequest): ExportSummary {
  const csv = request.format === "csv";
  // csv only has the first sensor, json all of them
  const series = csv ? request.series.slice(0, 1) : request.series;
  const readings: ExportSummary["readings"] = {};
  let values = 0;
  // csv: separator hint and header with their newlines, json: "[" and "]\n"
  let bytes = csv ? CSV_SEPARATOR_HINT.length + CSV_HEADER.length + 2 : 3;

  for (const [index, current] of series.entries()) {
    const points = readingsInRange(current.readings, request.from, request.to);
    values += points.length;
    readings[current.sensorId] =
      points.length > 0
        ? { first: points[0].value, last: points[points.length - 1].value }
        : null;

    if (csv) {
      // every line with its newline
      for (const point of points) bytes += csvLine(point).length + 1;
    } else {
      // head, the values with a comma between them, "]}", and a comma before every sensor but the first
      bytes += (index > 0 ? 1 : 0) + jsonHead(current.sensorId).length + 2;
      for (const point of points) bytes += jsonValue(point).length;
      bytes += Math.max(0, points.length - 1);
    }
  }

  return {
    values,
    bytes,
    readings,
    gaps: mergeGaps(
      series.flatMap((current) =>
        gapsInRange(current.gaps, request.from, request.to),
      ),
    ),
  };
}

// both sensors have the same gaps, so each gap should only show up once
function mergeGaps(gaps: Gap[]): Gap[] {
  const sorted = [...gaps].sort((a, b) => a.start - b.start);
  const merged: Gap[] = [];
  for (const gap of sorted) {
    const last = merged[merged.length - 1];
    if (last && gap.start <= last.end) {
      last.end = Math.max(last.end, gap.end);
    } else {
      merged.push({ ...gap });
    }
  }
  return merged;
}
