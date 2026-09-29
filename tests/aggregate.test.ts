import { describe, expect, it } from "vitest";
import { aggregate, aggregateAllLevels, ZOOM_LEVELS } from "@/lib/aggregate";
import { zurichToUnix } from "@/lib/time";
import { INTERVAL } from "@/lib/timeseries";
import type { DataPoint } from "@/lib/types";

// midnight swiss time of that day
function day(date: string): number {
  return zurichToUnix(`${date}T00:00:00`);
}

// 15 min values from start (included) to end (not included), all with the same value
function series(start: number, end: number, value = 1): DataPoint[] {
  const points: DataPoint[] = [];
  for (let ts = start; ts < end; ts += INTERVAL) {
    points.push({ ts, value });
  }
  return points;
}

describe("aggregate usage", () => {
  it("15 min stays the same", () => {
    const points = series(day("2019-03-11"), day("2019-03-12"), 0.5);
    expect(aggregate(points, "usage", "15min")).toEqual(points);
  });

  it("hour = sum of 4 values", () => {
    const points = series(day("2019-03-11"), day("2019-03-11") + 2 * 3600);
    expect(aggregate(points, "usage", "hour")).toEqual([
      { ts: day("2019-03-11"), value: 4 },
      { ts: day("2019-03-11") + 3600, value: 4 },
    ]);
  });

  it("a normal day has 96 values", () => {
    const points = series(day("2019-03-11"), day("2019-03-13"));
    expect(aggregate(points, "usage", "day")).toEqual([
      { ts: day("2019-03-11"), value: 96 },
      { ts: day("2019-03-12"), value: 96 },
    ]);
  });

  it("clock change in march: the day only has 92 values", () => {
    const points = series(day("2019-03-30"), day("2019-04-01"));
    expect(aggregate(points, "usage", "day")).toEqual([
      { ts: day("2019-03-30"), value: 96 },
      { ts: day("2019-03-31"), value: 92 },
    ]);
  });

  it("clock change in october: the day has 100 values", () => {
    const points = series(day("2019-10-26"), day("2019-10-28"));
    expect(aggregate(points, "usage", "day")).toEqual([
      { ts: day("2019-10-26"), value: 96 },
      { ts: day("2019-10-27"), value: 100 },
    ]);
  });

  it("hours stay 4 values long during the clock change", () => {
    const points = series(day("2019-10-27"), day("2019-10-28"));
    const hours = aggregate(points, "usage", "hour");
    expect(hours).toHaveLength(25);
    expect(hours.every((h) => h.value === 4)).toBe(true);
  });

  it("week starts on monday", () => {
    // 2019-03-11 is a monday, 2019-03-24 a sunday
    const points = series(day("2019-03-11"), day("2019-03-25"));
    expect(aggregate(points, "usage", "week")).toEqual([
      { ts: day("2019-03-11"), value: 7 * 96 },
      { ts: day("2019-03-18"), value: 7 * 96 },
    ]);
  });

  it("week with clock change has 4 values less", () => {
    // 2019-03-25 is the monday after the change on sunday 2019-03-31
    const points = series(day("2019-03-25"), day("2019-04-01"));
    expect(aggregate(points, "usage", "week")).toEqual([
      { ts: day("2019-03-25"), value: 7 * 96 - 4 },
    ]);
  });

  it("month across the new year", () => {
    const points = series(day("2018-12-01"), day("2019-02-01"));
    expect(aggregate(points, "usage", "month")).toEqual([
      { ts: day("2018-12-01"), value: 31 * 96 },
      { ts: day("2019-01-01"), value: 31 * 96 },
    ]);
  });

  it("march 2019 has 4 values less because of the clock change", () => {
    const points = series(day("2019-03-01"), day("2019-04-01"));
    expect(aggregate(points, "usage", "month")).toEqual([
      { ts: day("2019-03-01"), value: 31 * 96 - 4 },
    ]);
  });

  it("gaps: buckets without values are just missing", () => {
    const points = [
      ...series(day("2019-03-11"), day("2019-03-12")),
      ...series(day("2019-03-14"), day("2019-03-15")),
    ];
    const days = aggregate(points, "usage", "day");
    expect(days.map((d) => d.ts)).toEqual([
      day("2019-03-11"),
      day("2019-03-14"),
    ]);
  });

  it("rounds away float errors", () => {
    const points = series(
      day("2019-03-11"),
      day("2019-03-11") + 3 * INTERVAL,
      0.1,
    );
    expect(aggregate(points, "usage", "hour")).toEqual([
      { ts: day("2019-03-11"), value: 0.3 },
    ]);
  });

  it("no values give no result", () => {
    expect(aggregate([], "usage", "day")).toEqual([]);
  });
});

describe("aggregate meter reading", () => {
  // a reading belongs to the end of its 15 min interval, like in computeMeterReadings
  function readings(start: number, end: number): DataPoint[] {
    return series(start, end).map((p, i) => ({
      ts: p.ts + INTERVAL,
      value: 1000 + i + 1,
    }));
  }

  it("takes the last value, not the sum", () => {
    const points = readings(day("2019-03-11"), day("2019-03-11") + 3600);
    expect(aggregate(points, "meterReading", "hour")).toEqual([
      { ts: day("2019-03-11"), value: 1004 },
    ]);
  });

  it("the reading at 00:00 belongs to the day before", () => {
    const points = readings(day("2019-03-11"), day("2019-03-13"));
    expect(aggregate(points, "meterReading", "day")).toEqual([
      { ts: day("2019-03-11"), value: 1096 },
      { ts: day("2019-03-12"), value: 1192 },
    ]);
  });

  it("clock change: last reading of the day with 92 or 100 values", () => {
    const march = readings(day("2019-03-31"), day("2019-04-01"));
    expect(aggregate(march, "meterReading", "day")).toEqual([
      { ts: day("2019-03-31"), value: 1092 },
    ]);

    const october = readings(day("2019-10-27"), day("2019-10-28"));
    expect(aggregate(october, "meterReading", "day")).toEqual([
      { ts: day("2019-10-27"), value: 1100 },
    ]);
  });

  it("the ESL reading of 1 february is the final reading of january", () => {
    const esl: DataPoint[] = [
      { ts: day("2019-01-01"), value: 19216.2 },
      { ts: day("2019-02-01"), value: 21869.2 },
      { ts: day("2019-03-01"), value: 23468.7 },
    ];
    expect(aggregate(esl, "meterReading", "month")).toEqual([
      { ts: day("2018-12-01"), value: 19216.2 },
      { ts: day("2019-01-01"), value: 21869.2 },
      { ts: day("2019-02-01"), value: 23468.7 },
    ]);
  });
});

describe("aggregateAllLevels", () => {
  it("returns all zoom levels", () => {
    const points = series(day("2019-03-01"), day("2019-04-01"));
    const levels = aggregateAllLevels(points, "usage");

    expect(Object.keys(levels)).toEqual([...ZOOM_LEVELS]);
    expect(levels["15min"]).toHaveLength(31 * 96 - 4);
    expect(levels.hour).toHaveLength(31 * 24 - 1);
    expect(levels.day).toHaveLength(31);
    expect(levels.month).toEqual([
      { ts: day("2019-03-01"), value: 31 * 96 - 4 },
    ]);
  });

  it("the sum stays the same on every level", () => {
    const points = series(day("2019-01-01"), day("2019-12-31"), 0.25);
    const levels = aggregateAllLevels(points, "usage");
    const sum = (list: DataPoint[]) => list.reduce((s, p) => s + p.value, 0);

    for (const level of ZOOM_LEVELS) {
      expect(sum(levels[level])).toBeCloseTo(points.length * 0.25, 6);
    }
  });
});
