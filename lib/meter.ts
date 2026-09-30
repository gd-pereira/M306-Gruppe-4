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

// backcalc = before the first esl reading, calculated backwards with sdat ÷ ratio (2018)
// measured = sdat values fitted to the esl readings (and after the last one: sdat ÷ ratio)
// eslOnly = no sdat anymore, only the esl readings (after 06.09.2021)
export type MeterSource = "backcalc" | "measured" | "eslOnly";

// start is included and end is not, like Gap
export interface SourceRange {
  source: MeterSource;
  start: number;
  end: number;
}

export interface MeterFit {
  readings: DataPoint[]; // one reading every 15 min while there is sdat
  ratio: number; // sdat ÷ esl, 3.00 in the test data, the ui shows "SDAT ÷ 3.00"
  sources: SourceRange[];
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

// sdat ÷ esl over all time ranges without gaps, a gap would make the ratio too small
// if every range has gaps we take them anyway, without any range there is nothing to measure
function measureRatio(fitted: Comparison[]): number {
  const complete = fitted.filter((c) => c.complete);
  const ranges = complete.length > 0 ? complete : fitted;

  let sdat = 0;
  let esl = 0;
  for (const range of ranges) {
    sdat += range.sdat;
    esl += range.esl;
  }

  return sdat > 0 && esl > 0 ? roundKwh(sdat / esl) : 1;
}

function sourceRanges(
  usage: DataPoint[],
  esl: DataPoint[],
  firstFitted: number,
): SourceRange[] {
  const sdatStart = usage[0].ts;
  const sdatEnd = usage[usage.length - 1].ts + INTERVAL;
  const lastEsl = esl[esl.length - 1].ts;
  const backcalcEnd = Math.min(Math.max(firstFitted, sdatStart), sdatEnd);

  const sources: SourceRange[] = [
    { source: "backcalc", start: sdatStart, end: backcalcEnd },
    { source: "measured", start: backcalcEnd, end: sdatEnd },
    { source: "eslOnly", start: sdatEnd, end: lastEsl },
  ];
  return sources.filter((range) => range.start < range.end);
}

// calculates absolute meter readings from the 15 min usage (sdat) and a few known readings (esl)
// each sdat value is the usage from ts to ts + 15 min, so the reading belongs to the end of that interval
// the sdat sums are about 3x the esl differences, so just adding them up would make 2018 negative.
// between two esl readings the sdat values are scaled with esl difference ÷ sdat sum,
// so every reading is hit exactly and gaps in sdat are made up for.
// before the first and after the last of these readings we use sdat ÷ the measured ratio.
// without any esl reading we have no starting point, so we return nothing
export function fitMeterReadings(
  usage: DataPoint[],
  esl: DataPoint[],
): MeterFit {
  if (esl.length === 0 || usage.length === 0) {
    return { readings: [], ratio: 1, sources: [] };
  }

  // only ranges that sdat covers completely from start to end can be fitted.
  // compareWithEsl already leaves out the range where sdat ends, the one where it starts
  // (esl before 2018) would be scaled with only part of its usage
  const fitted = compareWithEsl(usage, esl).filter(
    (c) => c.start >= usage[0].ts && (c.sdat > 0 || c.esl === 0),
  );
  const ratio = measureRatio(fitted);
  const sums = prefixSums(usage);
  const usageBefore = (ts: number) => sums[firstIndexFrom(usage, ts)];

  // with nothing to fit, one esl reading is the starting point for everything
  const start =
    fitted.length > 0
      ? {
          ts: fitted[0].start,
          value: esl[firstIndexFrom(esl, fitted[0].start)].value,
        }
      : nearestReading(esl, usage[0].ts);
  const endTs = fitted.length > 0 ? fitted[fitted.length - 1].end : start.ts;
  const end = { ts: endTs, value: esl[firstIndexFrom(esl, endTs)].value };

  const readings: DataPoint[] = [];
  let k = 0; // current fitted range, the readings are sorted so we only move forward

  for (let i = 0; i < usage.length; i++) {
    const ts = usage[i].ts + INTERVAL;
    const usageUntil = sums[i + 1];
    let value: number;

    if (ts <= start.ts) {
      value = start.value - (usageBefore(start.ts) - usageUntil) / ratio;
    } else if (ts > end.ts) {
      value = end.value + (usageUntil - usageBefore(end.ts)) / ratio;
    } else {
      while (fitted[k].end < ts) {
        k++;
      }
      const range = fitted[k];
      const rangeStart = usageBefore(range.start);
      const rangeUsage = usageBefore(range.end) - rangeStart;
      const factor = rangeUsage > 0 ? range.esl / rangeUsage : 0;
      const startValue = esl[firstIndexFrom(esl, range.start)].value;
      value = startValue + (usageUntil - rangeStart) * factor;
    }

    readings.push({ ts, value: roundKwh(value) });
  }

  return { readings, ratio, sources: sourceRanges(usage, esl, start.ts) };
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
