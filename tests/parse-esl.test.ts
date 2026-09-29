import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEsl } from "@/lib/parse-esl";
import type { Direction, Series } from "@/lib/types";

function parseFixture(name: string) {
  return parseEsl(readFileSync(`tests/fixtures/${name}`, "utf-8"), name);
}

function findSeries(series: Series[], direction: Direction) {
  return series.find((s) => s.direction === direction);
}

describe("parseEsl", () => {
  it("reads all TimePeriods and adds high and low tariff", () => {
    const result = parseFixture("esl-2019-03.xml");
    if (!result.ok) throw new Error(result.error.message);

    // end="2019-02-01T00:00:00" and "2019-03-01T00:00:00" in swiss winter time (UTC+1)
    const feb = Date.UTC(2019, 0, 31, 23) / 1000;
    const mar = Date.UTC(2019, 1, 28, 23) / 1000;

    // sums calculated by hand from the file
    const consumption = findSeries(result.series, "consumption");
    expect(consumption?.sensorId).toBe("ID742");
    expect(consumption?.kind).toBe("meterReading");
    expect(consumption?.points).toEqual([
      { ts: feb, value: 21869.2 }, // 5837.2 + 16032.0
      { ts: mar, value: 23468.7 }, // 6339.7 + 17129.0
    ]);

    const feedIn = findSeries(result.series, "feedIn");
    expect(feedIn?.sensorId).toBe("ID735");
    expect(feedIn?.points).toEqual([
      { ts: feb, value: 11803.3 }, // 8258.8 + 3544.5
      { ts: mar, value: 11959.7 }, // 8348.4 + 3611.3
    ]);
  });

  it("reads the creation date of the file", () => {
    const result = parseFixture("esl-2019-03.xml");
    if (!result.ok) throw new Error(result.error.message);

    // created ="2019-03-14T09:34:00" in swiss winter time (UTC+1)
    const createdAt = Date.UTC(2019, 2, 14, 8, 34) / 1000;
    for (const series of result.series) {
      expect(series.createdAt).toBe(createdAt);
    }
  });

  it("skips time periods with missing OBIS codes", () => {
    const result = parseFixture("esl-partial.xml");
    if (!result.ok) throw new Error(result.error.message);

    // may and june only have consumption, july has both (summer time, UTC+2)
    const may = Date.UTC(2020, 3, 30, 22) / 1000;
    const jun = Date.UTC(2020, 4, 31, 22) / 1000;
    const jul = Date.UTC(2020, 5, 30, 22) / 1000;

    expect(findSeries(result.series, "consumption")?.points).toEqual([
      { ts: may, value: 37736.4 }, // 12095.0 + 25641.4
      { ts: jun, value: 38406.2 }, // 12283.1 + 26123.1
      { ts: jul, value: 38975.5 }, // 12460.1 + 26515.4
    ]);
    expect(findSeries(result.series, "feedIn")?.points).toEqual([
      { ts: jul, value: 18502.7 }, // 12269.7 + 6233.0
    ]);
  });

  it("file with only a water meter gives no series", () => {
    const result = parseFixture("esl-water.xml");

    expect(result).toEqual({ ok: true, series: [] });
  });

  it("broken file gives an error instead of crashing", () => {
    const result = parseFixture("sdat-broken.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.file).toBe("sdat-broken.xml");
  });

  it("SDAT file is not an ESL file", () => {
    const result = parseFixture("sdat-ID742.xml");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toBe("Not an ESL file");
  });
});
