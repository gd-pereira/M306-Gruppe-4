import { describe, expect, it } from "vitest";
import { compareWithEsl, computeMeterReadings } from "@/lib/meter";
import { INTERVAL } from "@/lib/timeseries";
import type { DataPoint } from "@/lib/types";

const T = Date.UTC(2019, 1, 28, 23) / 1000; // 2019-03-01 00:00 swiss time

// 15 min usage values starting at T
function usage(values: number[]): DataPoint[] {
  return values.map((value, i) => ({ ts: T + i * INTERVAL, value }));
}

// time after n intervals
function after(n: number): number {
  return T + n * INTERVAL;
}

describe("computeMeterReadings", () => {
  it("known start + values = expected final reading", () => {
    const esl = [{ ts: T, value: 1000 }];

    expect(computeMeterReadings(usage([1, 2, 3, 4]), esl)).toEqual([
      { ts: after(1), value: 1001 },
      { ts: after(2), value: 1003 },
      { ts: after(3), value: 1006 },
      { ts: after(4), value: 1010 },
    ]);
  });

  it("calculates backwards from the ESL reading if it is later", () => {
    // like 2018: sdat values before the first esl reading
    const esl = [{ ts: after(4), value: 1010 }];

    expect(computeMeterReadings(usage([1, 2, 3, 4]), esl)).toEqual([
      { ts: after(1), value: 1001 },
      { ts: after(2), value: 1003 },
      { ts: after(3), value: 1006 },
      { ts: after(4), value: 1010 },
    ]);
  });

  it("always uses the nearest ESL reading", () => {
    // sdat says +8, esl says +1000, so both halves have their own reference
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(8), value: 2000 },
    ];
    const readings = computeMeterReadings(usage([1, 1, 1, 1, 1, 1, 1, 1]), esl);

    // up to the middle (tie goes to the earlier one) forward from 1000, then backward from 2000
    expect(readings.map((p) => p.value)).toEqual([
      1001, 1002, 1003, 1004, 1997, 1998, 1999, 2000,
    ]);
  });

  it("gaps count as no usage", () => {
    const esl = [{ ts: T, value: 1000 }];
    const points = [
      { ts: after(0), value: 1 },
      { ts: after(3), value: 1 }, // 2 values missing in between
    ];

    expect(computeMeterReadings(points, esl)).toEqual([
      { ts: after(1), value: 1001 },
      { ts: after(4), value: 1002 },
    ]);
  });

  it("no ESL reading gives no meter reading", () => {
    expect(computeMeterReadings(usage([1, 2, 3]), [])).toEqual([]);
  });

  it("no rounding errors like 19216.199999", () => {
    const esl = [{ ts: T, value: 19216.1 }];
    const readings = computeMeterReadings(usage([0.1, 0.2]), esl);

    expect(readings.map((p) => p.value)).toEqual([19216.2, 19216.4]);
  });
});

describe("compareWithEsl", () => {
  const esl = (difference: number) => [
    { ts: T, value: 1000 },
    { ts: after(4), value: 1000 + difference },
  ];
  const points = usage([1, 2, 3, 4]); // sum 10

  it("returns SDAT sum and ESL difference per time range", () => {
    expect(compareWithEsl(points, esl(10))).toEqual([
      { start: T, end: after(4), sdat: 10, esl: 10, complete: true },
    ]);
  });

  it("factor 3 like in the test data is not marked", () => {
    // sdat 30 vs esl 10, the client said to keep the values as they are
    const [comparison] = compareWithEsl(usage([3, 6, 9, 12]), esl(10));

    expect(comparison.sdat).toBe(30);
    expect(comparison.complete).toBe(true);
  });

  it("notices when SDAT values are missing", () => {
    // the 3rd value is missing, like the gaps in 02/2020, 06/2020, 02/2021 and 03/2021
    const withGap = [points[0], points[1], points[3]];
    const [comparison] = compareWithEsl(withGap, esl(10));

    expect(comparison.sdat).toBe(7);
    expect(comparison.complete).toBe(false);
  });

  it("skips the time range where the SDAT data ends", () => {
    // like 09/2021: sdat stops on 06.09., that is not a gap
    expect(compareWithEsl(points.slice(0, 3), esl(10))).toEqual([]);
  });

  it("skips time ranges without SDAT values", () => {
    // like after september 2021, only esl
    const later = [
      { ts: after(100), value: 2000 },
      { ts: after(200), value: 2100 },
    ];

    expect(compareWithEsl(points, later)).toEqual([]);
  });
});
