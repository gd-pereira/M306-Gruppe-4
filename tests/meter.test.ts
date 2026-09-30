import { describe, expect, it } from "vitest";
import { compareWithEsl, fitMeterReadings, type MeterFit } from "@/lib/meter";
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

describe("fitMeterReadings", () => {
  const values = (fit: MeterFit) => fit.readings.map((p) => p.value);

  it("scales sdat so it hits the next ESL reading exactly", () => {
    // sdat says +30, esl says +10, so every value counts a third
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(4), value: 1010 },
    ];

    expect(fitMeterReadings(usage([3, 6, 9, 12]), esl).readings).toEqual([
      { ts: after(1), value: 1001 },
      { ts: after(2), value: 1003 },
      { ts: after(3), value: 1006 },
      { ts: after(4), value: 1010 },
    ]);
  });

  it("every time range between two readings has its own factor", () => {
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(2), value: 1010 }, // factor 5
      { ts: after(4), value: 1012 }, // factor 1
    ];

    expect(values(fitMeterReadings(usage([1, 1, 1, 1]), esl))).toEqual([
      1005, 1010, 1011, 1012,
    ]);
  });

  it("calculates backwards with the measured ratio before the first reading", () => {
    // like 2018: sdat before the first esl reading, sdat is 3x esl
    const esl = [
      { ts: after(4), value: 1000 },
      { ts: after(8), value: 1004 },
    ];
    const fit = fitMeterReadings(usage([3, 3, 3, 3, 3, 3, 3, 3]), esl);

    expect(fit.ratio).toBe(3);
    expect(values(fit)).toEqual([997, 998, 999, 1000, 1001, 1002, 1003, 1004]);
  });

  it("goes on with the measured ratio after the last reading", () => {
    // like 01.09. to 06.09.2021: sdat goes on, the next esl reading is after sdat ends
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(4), value: 1004 },
      { ts: after(100), value: 1100 },
    ];

    expect(values(fitMeterReadings(usage([3, 3, 3, 3, 3, 3]), esl))).toEqual([
      1001, 1002, 1003, 1004, 1005, 1006,
    ]);
  });

  it("the factor makes up for gaps, the ESL reading is still hit", () => {
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(4), value: 1010 },
    ];
    const points = [
      { ts: after(0), value: 1 },
      { ts: after(1), value: 1 },
      { ts: after(3), value: 2 }, // 1 value missing in between
    ];

    expect(fitMeterReadings(points, esl).readings).toEqual([
      { ts: after(1), value: 1002.5 },
      { ts: after(2), value: 1005 },
      { ts: after(4), value: 1010 },
    ]);
  });

  it("the ratio only uses time ranges without gaps", () => {
    const esl = [
      { ts: T, value: 1000 },
      { ts: after(2), value: 1002 }, // complete, sdat 6 vs esl 2
      { ts: after(4), value: 1003 }, // one value missing, sdat 2 vs esl 1
      { ts: after(6), value: 1005 }, // complete, sdat 6 vs esl 2
    ];
    const points = [
      { ts: after(0), value: 3 },
      { ts: after(1), value: 3 },
      { ts: after(2), value: 2 },
      { ts: after(4), value: 3 },
      { ts: after(5), value: 3 },
    ];

    // with the gap it would be 14 / 5 = 2.8
    expect(fitMeterReadings(points, esl).ratio).toBe(3);
  });

  it("tells where the values come from", () => {
    const esl = [
      { ts: after(2), value: 1000 },
      { ts: after(4), value: 1002 },
      { ts: after(10), value: 1010 },
    ];

    expect(fitMeterReadings(usage([3, 3, 3, 3, 3, 3]), esl).sources).toEqual([
      { source: "backcalc", start: T, end: after(2) },
      { source: "measured", start: after(2), end: after(6) },
      { source: "eslOnly", start: after(6), end: after(10) },
    ]);
  });

  it("with only one ESL reading it adds the sdat values as they are", () => {
    const fit = fitMeterReadings(usage([1, 2, 3, 4]), [{ ts: T, value: 1000 }]);

    expect(fit.ratio).toBe(1);
    expect(values(fit)).toEqual([1001, 1003, 1006, 1010]);
  });

  it("no ESL reading gives no meter reading", () => {
    expect(fitMeterReadings(usage([1, 2, 3]), [])).toEqual({
      readings: [],
      ratio: 1,
      sources: [],
    });
  });

  it("no rounding errors like 19216.199999", () => {
    const fit = fitMeterReadings(usage([0.1, 0.2]), [
      { ts: T, value: 19216.1 },
    ]);

    expect(values(fit)).toEqual([19216.2, 19216.4]);
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
