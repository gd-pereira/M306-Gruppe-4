import { roundKwh } from "@/lib/math";
import { zurichToUnix } from "@/lib/time";
import { INTERVAL } from "@/lib/timeseries";
import type { DataPoint, Series } from "@/lib/types";

// zoom levels of the chart, from fine to coarse
export const ZOOM_LEVELS = ["15min", "hour", "day", "week", "month"] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

// a time bucket, start is included and end is not (unix seconds)
export interface Bucket {
  start: number;
  end: number;
}

const HOUR = 60 * 60;

// year, month (1-12) and day of a moment in swiss local time
function zurichDate(ts: number): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(ts * 1000));

  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

// unix seconds of midnight swiss time on that day
// Date.UTC handles overflow, so day 32 or month 13 just roll over to the next month or year
function zurichMidnight(year: number, month: number, day: number): number {
  const iso = new Date(Date.UTC(year, month - 1, day))
    .toISOString()
    .slice(0, 10);
  return zurichToUnix(`${iso}T00:00:00`);
}

// the bucket of the given zoom level that contains ts
// hours can be calculated directly because the swiss offset is always a full hour,
// days, weeks and months start at midnight swiss time and are 23 or 25 hours longer or shorter
// when the clock changes, so for those we go through the calendar
export function bucketAt(ts: number, level: ZoomLevel): Bucket {
  if (level === "15min" || level === "hour") {
    const length = level === "15min" ? INTERVAL : HOUR;
    const start = Math.floor(ts / length) * length;
    return { start, end: start + length };
  }

  const { year, month, day } = zurichDate(ts);

  if (level === "day") {
    return {
      start: zurichMidnight(year, month, day),
      end: zurichMidnight(year, month, day + 1),
    };
  }

  if (level === "week") {
    // weeks start on monday, getUTCDay gives 0 for sunday
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const monday = day - ((weekday + 6) % 7);
    return {
      start: zurichMidnight(year, month, monday),
      end: zurichMidnight(year, month, monday + 7),
    };
  }

  return {
    start: zurichMidnight(year, month, 1),
    end: zurichMidnight(year, month + 1, 1),
  };
}

// combines the points per bucket of the zoom level, ts of the result is the start of the bucket
// usage: sum of all values in the bucket
// meterReading: the last reading in the bucket. a reading belongs to the end of its interval
// (see computeMeterReadings), so a reading at exactly 00:00 is the end of the day before
// points must be sorted by ts
export function aggregate(
  points: DataPoint[],
  kind: Series["kind"],
  level: ZoomLevel,
): DataPoint[] {
  const result: DataPoint[] = [];
  // readings are shifted by one second so a reading on the border counts to the bucket before
  const shift = kind === "meterReading" ? 1 : 0;

  let bucket: Bucket | undefined;
  let value = 0;

  for (const point of points) {
    const ts = point.ts - shift;

    // only ask the calendar when we leave the current bucket, not for every value
    if (bucket === undefined || ts >= bucket.end) {
      if (bucket !== undefined) {
        result.push({ ts: bucket.start, value: roundKwh(value) });
      }
      bucket = bucketAt(ts, level);
      value = 0;
    }

    value = kind === "usage" ? value + point.value : point.value;
  }

  if (bucket !== undefined) {
    result.push({ ts: bucket.start, value: roundKwh(value) });
  }

  return result;
}

// calculates all zoom levels at once, so switching in the chart needs no calculation
export function aggregateAllLevels(
  points: DataPoint[],
  kind: Series["kind"],
): Record<ZoomLevel, DataPoint[]> {
  const levels = {} as Record<ZoomLevel, DataPoint[]>;
  for (const level of ZOOM_LEVELS) {
    levels[level] = aggregate(points, kind, level);
  }
  return levels;
}
