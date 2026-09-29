import type { DataPoint, Series } from "@/lib/types";

// sdat values are 15 min apart, in seconds
export const INTERVAL = 15 * 60;

// a time range without any values, start is included and end is not
export interface Gap {
  start: number;
  end: number;
}

// puts all series of one sensor into a single list, one value per timestamp
// works for sdat (usage) and esl (meter readings), just don't mix the two
// the same timestamp often shows up in several files,
// then the value from the file with the newest creation date wins
// (sdat placeholders with condition 21 were already removed by the parser)
export function mergeSeries(series: Series[]): DataPoint[] {
  // timestamp -> best value so far and the creation date of its file
  const best = new Map<number, { value: number; createdAt: number }>();

  for (const { points, createdAt = 0 } of series) {
    for (const point of points) {
      const current = best.get(point.ts);

      // take the value if we have none yet or if this file is newer
      if (current === undefined || createdAt > current.createdAt) {
        best.set(point.ts, { value: point.value, createdAt });
      }
    }
  }

  // turn the map back into a normal list
  const merged: DataPoint[] = [];
  for (const [ts, entry] of best) {
    merged.push({ ts, value: entry.value });
  }

  merged.sort((a, b) => a.ts - b.ts);
  return merged;
}

// finds all places where values are missing
// points must be sorted by ts
export function findGaps(points: DataPoint[]): Gap[] {
  const gaps: Gap[] = [];

  for (let i = 1; i < points.length; i++) {
    // the next value should come exactly 15 min after the one before
    const expected = points[i - 1].ts + INTERVAL;

    if (points[i].ts > expected) {
      gaps.push({ start: expected, end: points[i].ts });
    }
  }

  return gaps;
}

// returns the index of the first point with a ts >= the given time
// if there is none, it returns points.length
// uses binary search: look at the middle, then keep only the half that can contain the answer
// so for 128'000 values we only need about 17 steps instead of going through all of them
export function firstIndexFrom(points: DataPoint[], ts: number): number {
  let low = 0;
  let high = points.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);

    if (points[mid].ts < ts) {
      // the middle is too early, so the answer is on the right side
      low = mid + 1;
    } else {
      // the middle could be the answer, but maybe there is an earlier one on the left
      high = mid;
    }
  }

  return low;
}

// returns all points with start <= ts < end
// points must be sorted by ts
export function pointsInRange(
  points: DataPoint[],
  start: number,
  end: number,
): DataPoint[] {
  return points.slice(
    firstIndexFrom(points, start),
    firstIndexFrom(points, end),
  );
}
