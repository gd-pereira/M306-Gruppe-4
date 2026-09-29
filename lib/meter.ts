import { roundKwh } from "@/lib/math";
import { firstIndexFrom, INTERVAL, pointsInRange } from "@/lib/timeseries";
import type { DataPoint } from "@/lib/types";

// result of comparing sdat with esl for the time between two esl readings
// there is no allowed deviation: in the test data sdat is always 3x esl (confirmed by the client),
// so a limit would mark every month. months with missing sdat values are marked instead
export interface Comparison {
  start: number; // ts of the first esl reading
  end: number; // ts of the next esl reading
  sdat: number; // sum of all sdat values in between (kWh)
  esl: number; // difference of the two esl readings (kWh)
  complete: boolean; // false if some sdat values are missing in between
}

// returns the esl reading that is closest in time to ts
// if both neighbours are equally far away, we take the earlier one
// esl must be sorted by ts and must not be empty
function nearestReading(esl: DataPoint[], ts: number): DataPoint {
  const i = firstIndexFrom(esl, ts);

  // ts is before the first or after the last esl reading
  if (i === 0) {
    return esl[0];
  }
  if (i === esl.length) {
    return esl[esl.length - 1];
  }

  // otherwise ts lies between esl[i - 1] and esl[i]
  const before = esl[i - 1];
  const after = esl[i];
  if (ts - before.ts <= after.ts - ts) {
    return before;
  }
  return after;
}

// running total: sums[i] = usage of the first i values
// sums[0] is 0, sums[1] is the first value, sums[2] the first two, ...
// with this we get the usage between two times with one subtraction instead of a loop
function prefixSums(usage: DataPoint[]): number[] {
  const sums = [0];
  let total = 0;

  for (const point of usage) {
    total += point.value;
    sums.push(total);
  }

  return sums;
}

// calculates absolute meter readings from the 15 min usage (sdat) and a few known readings (esl)
// each sdat value is the usage from ts to ts + 15 min, so the reading belongs to the end of that interval
// we start at the closest esl reading: add the usage when going forward, subtract it when going backward
// without any esl reading we have no starting point, so we return nothing
export function computeMeterReadings(
  usage: DataPoint[],
  esl: DataPoint[],
): DataPoint[] {
  if (esl.length === 0) {
    return [];
  }

  const sums = prefixSums(usage);
  const readings: DataPoint[] = [];

  for (const point of usage) {
    const end = point.ts + INTERVAL;
    const reference = nearestReading(esl, end);

    // usage of everything before "end" and of everything before the esl reading
    const usageUntilEnd = sums[firstIndexFrom(usage, end)];
    const usageUntilReference = sums[firstIndexFrom(usage, reference.ts)];

    // positive if the esl reading is earlier (add), negative if it is later (subtract)
    const between = usageUntilEnd - usageUntilReference;

    readings.push({ ts: end, value: roundKwh(reference.value + between) });
  }

  return readings;
}

// compares the sdat sum between two esl readings with the difference of those readings
// and checks if every 15 min value is there
// skipped: time ranges without any sdat value and the range where sdat ends (06.09.2021),
// that one is not a gap, the data just stops. the client confirmed only the 4 months with gaps
export function compareWithEsl(
  usage: DataPoint[],
  esl: DataPoint[],
): Comparison[] {
  const comparisons: Comparison[] = [];
  if (usage.length === 0) {
    return comparisons;
  }
  const sdatEnd = usage[usage.length - 1].ts + INTERVAL;

  for (let i = 1; i < esl.length; i++) {
    const start = esl[i - 1];
    const end = esl[i];

    const inRange = pointsInRange(usage, start.ts, end.ts);
    if (inRange.length === 0 || end.ts > sdatEnd) {
      continue;
    }

    let sum = 0;
    for (const point of inRange) {
      sum += point.value;
    }

    // a full range has one value every 15 min
    const expected = (end.ts - start.ts) / INTERVAL;

    comparisons.push({
      start: start.ts,
      end: end.ts,
      sdat: roundKwh(sum),
      esl: roundKwh(end.value - start.value),
      complete: inRange.length === expected,
    });
  }

  return comparisons;
}
