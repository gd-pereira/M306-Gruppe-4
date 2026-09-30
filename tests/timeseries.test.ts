import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEsl } from "@/lib/parse-esl";
import {
  findGaps,
  firstIndexFrom,
  INTERVAL,
  mergeSeries,
  mergeSeriesWithSources,
  pointsInRange,
} from "@/lib/timeseries";
import type { DataPoint, Series } from "@/lib/types";

const T = Date.UTC(2019, 2, 11, 23) / 1000; // any start time

// sdat series with values at T, T + 15 min, ...
function series(createdAt: number, values: number[], offset = 0): Series {
  return {
    sensorId: "ID742",
    direction: "consumption",
    kind: "usage",
    createdAt,
    points: values.map((value, i) => ({
      ts: T + (offset + i) * INTERVAL,
      value,
    })),
  };
}

describe("mergeSeries", () => {
  it("per timestamp the file with the newest creation date wins", () => {
    const older = series(100, [1, 1, 1]);
    const newer = series(200, [2, 2], 1); // overlaps the last two values

    // order of the files must not matter
    const expected = [
      { ts: T, value: 1 },
      { ts: T + INTERVAL, value: 2 },
      { ts: T + 2 * INTERVAL, value: 2 },
    ];
    expect(mergeSeries([older, newer])).toEqual(expected);
    expect(mergeSeries([newer, older])).toEqual(expected);
  });

  it("older file fills values that are missing in the newer one", () => {
    // like a newer file where the parser dropped a condition 21 placeholder
    const older = series(100, [0.6, 0.9]);
    const newer: Series = {
      ...series(200, []),
      points: [{ ts: T, value: 0.3 }],
    };

    expect(mergeSeries([newer, older])).toEqual([
      { ts: T, value: 0.3 },
      { ts: T + INTERVAL, value: 0.9 },
    ]);
  });

  it("sorts chronologically", () => {
    const later = series(100, [5], 4);
    const earlier = series(100, [1], 0);

    const merged = mergeSeries([later, earlier]);
    expect(merged.map((p) => p.ts)).toEqual([T, T + 4 * INTERVAL]);
  });

  it("no series give no values", () => {
    expect(mergeSeries([])).toEqual([]);
  });
});

// esl files overlap too, e.g. the reading of 1 february is in several monthly exports
describe("mergeSeriesWithSources", () => {
  it("returns the series that gave at least one kept value", () => {
    const older = series(100, [1, 1, 1]);
    const newer = series(200, [2, 2], 1); // overwrites the last two values of older
    const covered = series(50, [9]); // older than both, gives nothing

    const { points, used } = mergeSeriesWithSources([older, newer, covered]);

    expect(points.map((p) => p.value)).toEqual([1, 2, 2]);
    expect(used).toEqual(new Set([older, newer]));
  });

  it("same creation date: the series read first stays", () => {
    const first = series(100, [1]);
    const second = series(100, [2]);

    const { used } = mergeSeriesWithSources([first, second]);

    expect(used).toEqual(new Set([first]));
  });
});

describe("mergeSeries with ESL files", () => {
  function consumptionFrom(xml: string, file: string): Series {
    const result = parseEsl(xml, file);
    if (!result.ok) throw new Error(result.error.message);
    const consumption = result.series.find(
      (s) => s.direction === "consumption",
    );
    if (!consumption) throw new Error("no consumption");
    return consumption;
  }

  const january = readFileSync("tests/fixtures/esl-2019-01.xml", "utf-8");
  const march = readFileSync("tests/fixtures/esl-2019-03.xml", "utf-8");

  const jan1 = Date.UTC(2018, 11, 31, 23) / 1000; // 2019-01-01 swiss time
  const feb1 = Date.UTC(2019, 0, 31, 23) / 1000;
  const mar1 = Date.UTC(2019, 1, 28, 23) / 1000;

  it("different files give one sorted list", () => {
    const merged = mergeSeries([
      consumptionFrom(march, "march.xml"),
      consumptionFrom(january, "january.xml"),
    ]);

    expect(merged).toEqual([
      { ts: jan1, value: 19216.2 }, // 4755.3 + 14460.9
      { ts: feb1, value: 21869.2 },
      { ts: mar1, value: 23468.7 },
    ]);
  });

  it("duplicate timestamp: the newer file wins", () => {
    // a later export of the same file with a corrected february reading
    const corrected = march
      .replace(
        'created ="2019-03-14T09:34:00"',
        'created ="2019-03-20T09:00:00"',
      )
      .replace('value="5837.2000"', 'value="5837.5000"');

    const expected = [
      { ts: feb1, value: 21869.5 }, // 5837.5 + 16032.0
      { ts: mar1, value: 23468.7 },
    ];
    // order of the files must not matter
    expect(
      mergeSeries([
        consumptionFrom(march, "old.xml"),
        consumptionFrom(corrected, "new.xml"),
      ]),
    ).toEqual(expected);
    expect(
      mergeSeries([
        consumptionFrom(corrected, "new.xml"),
        consumptionFrom(march, "old.xml"),
      ]),
    ).toEqual(expected);
  });
});

describe("findGaps", () => {
  it("finds missing 15 min values", () => {
    const points: DataPoint[] = [0, 1, 4, 5, 8].map((i) => ({
      ts: T + i * INTERVAL,
      value: 1,
    }));

    expect(findGaps(points)).toEqual([
      { start: T + 2 * INTERVAL, end: T + 4 * INTERVAL },
      { start: T + 6 * INTERVAL, end: T + 8 * INTERVAL },
    ]);
  });

  it("a series without gaps has no gaps", () => {
    expect(findGaps(series(0, [1, 2, 3, 4]).points)).toEqual([]);
  });
});

describe("pointsInRange", () => {
  const points = series(0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).points;

  it("start inclusive, end exclusive", () => {
    const range = pointsInRange(points, T + 2 * INTERVAL, T + 5 * INTERVAL);
    expect(range.map((p) => p.value)).toEqual([2, 3, 4]);
  });

  it("bounds between two values", () => {
    const range = pointsInRange(
      points,
      T + 2 * INTERVAL + 1,
      T + 5 * INTERVAL - 1,
    );
    expect(range.map((p) => p.value)).toEqual([3, 4]);
  });

  it("range outside the data is empty", () => {
    expect(pointsInRange(points, T - 10 * INTERVAL, T)).toEqual([]);
    expect(
      pointsInRange(points, T + 100 * INTERVAL, T + 200 * INTERVAL),
    ).toEqual([]);
  });

  it("binary search matches linear search", () => {
    // every time from before the first to after the last value, also between values
    for (let ts = T - INTERVAL; ts <= T + 11 * INTERVAL; ts += 300) {
      const linear = points.findIndex((p) => p.ts >= ts);
      expect(firstIndexFrom(points, ts)).toBe(
        linear === -1 ? points.length : linear,
      );
    }
  });
});
