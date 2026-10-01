import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  eslReadings,
  gapsIn,
  isIncomplete,
  meterLine,
  meterScope,
  realAnalysisData,
  usageBuckets,
  usageScope,
  usageTotals,
  valueCount,
  type AnalysisData,
} from "@/components/analysis/analysis-data";
import { dayOf } from "@/components/export/export-data";
import { importView } from "@/components/import/import-view";
import {
  addFile,
  buildResult,
  createParsedFiles,
  type ImportResult,
} from "@/lib/import";
import { SENSOR_IDS } from "@/lib/types";

// the verbrauch and zählerstand pages on the whole test data (data/sdat and data/esl),
// reading it takes about 10 seconds
let result: ImportResult;
let data: AnalysisData;
let all: { from: string; to: string };

function importDirs(keep: (dir: string, name: string) => boolean) {
  const parsed = createParsedFiles();
  for (const dir of ["data/sdat", "data/esl"]) {
    for (const name of readdirSync(dir)) {
      if (!keep(dir, name)) continue;
      addFile(parsed, name, readFileSync(path.join(dir, name), "utf8"));
    }
  }
  return buildResult(parsed);
}

beforeAll(() => {
  result = importDirs(() => true);
  data = realAnalysisData(result);
  all = usageScope(data).data;
}, 60_000);

describe("real analysis data", () => {
  it("takes its window from the files", () => {
    expect(data.window).toEqual({
      from: "2018-01-01",
      to: "2021-09-06",
      firstEsl: "2019-01-01",
      lastEsl: "2022-09-01",
    });
    expect(meterScope(data).all).toEqual({
      from: "2018-01-01",
      to: "2022-12-31",
    });
  });

  it("has the 4 gaps of the data and every other value", () => {
    expect(data.gaps).toEqual([
      { from: "2020-02-09", to: "2020-02-09" },
      { from: "2020-06-14", to: "2020-06-15" },
      { from: "2021-02-18", to: "2021-02-24" },
      { from: "2021-03-27", to: "2021-03-27" },
    ]);
    expect(valueCount(data)).toBe(result.consumption.valueCount);
    expect(data.ratio).toBe(3);
  });

  it("sums the sdat values as they are in the files, not divided by 3", () => {
    const totals = usageTotals(all, data);
    const sum = (points: { value: number }[]) =>
      points.reduce((total, point) => total + point.value, 0);
    expect(totals.consumption).toBeCloseTo(
      sum(result.consumption.usage["15min"]),
      1,
    );
    expect(totals.feedIn).toBeCloseTo(sum(result.feedIn.usage["15min"]), 1);
  });

  it("matches the dashboard mockup", () => {
    const totals = usageTotals(all, data);
    expect(Math.round(totals.consumption)).toBe(151_412);
    expect(totals.peak?.value).toBeCloseTo(7.2, 1);
  });

  it("sums up the import page for all files", () => {
    const { files, summary } = importView(result);
    expect(files).toHaveLength(5180);
    expect(files.filter((f) => f.status === "error")).toHaveLength(0);
    expect(files.filter((f) => f.status === "ignored")).toHaveLength(1708);
    expect(summary.eslFiles).toBe(47);
    expect(summary.gapDays).toBe(11);
    expect(summary.kwh.consumption).toBeCloseTo(
      usageTotals(all, data).consumption,
      0,
    );
  });

  it("gives the same total on every resolution", () => {
    const year = { from: "2020-01-01", to: "2020-12-31" };
    const total = usageTotals(year, data).consumption;
    for (const resolution of ["15min", "hour", "day"] as const) {
      const buckets = usageBuckets(year, resolution, data);
      const sum = buckets.reduce((s, b) => s + (b.consumption ?? 0), 0);
      expect(sum).toBeCloseTo(total, 1);
    }
    // gap days stay empty instead of 0
    const days = usageBuckets(year, "day", data);
    expect(days.filter((day) => day.consumption === null)).toHaveLength(3);
  });

  it("keeps every value of a partial import (only the sdat files of 2020)", () => {
    const partial = importDirs(
      (dir, name) => dir === "data/esl" || name.startsWith("2020"),
    );
    const part = realAnalysisData(partial);
    const usage = partial.consumption.usage["15min"];
    expect(part.window.from).toBe(dayOf(usage[0].ts));
    expect(part.window.to).toBe(dayOf(usage[usage.length - 1].ts));
    expect(part.window.to < data.window.to).toBe(true);
    // nothing outside a fixed window is dropped
    expect(valueCount(part)).toBe(partial.consumption.valueCount);
    const line = meterLine(
      SENSOR_IDS.consumption,
      usageScope(part).data,
      "day",
      part,
    );
    expect(line[0].value).toBeGreaterThan(0);
    for (let i = 1; i < line.length; i++) {
      expect(line[i].value).toBeGreaterThanOrEqual(line[i - 1].value);
    }
  }, 60_000);

  describe.each([SENSOR_IDS.consumption, SENSOR_IDS.feedIn])(
    "meter reading %s",
    (sensor) => {
      it("is never negative and always goes up, on every resolution", () => {
        for (const resolution of ["15min", "hour", "day"] as const) {
          const line = meterLine(sensor, all, resolution, data);
          expect(line[0].value).toBeGreaterThan(0);
          for (let i = 1; i < line.length; i++) {
            expect(line[i].value).toBeGreaterThanOrEqual(line[i - 1].value);
          }
        }
      });

      it("hits every esl reading while there is sdat", () => {
        const line = meterLine(sensor, all, "15min", data);
        const byTs = new Map(line.map((point) => [point.ts, point.value]));
        const hit = eslReadings(sensor, data).filter((r) => byTs.has(r.ts));
        // 01.01.2019 to 01.09.2021
        expect(hit).toHaveLength(33);
        for (const reading of hit) {
          expect(byTs.get(reading.ts)).toBeCloseTo(reading.value, 4);
        }
      });

      it("marks the 4 months with gaps", () => {
        const incomplete = eslReadings(sensor, data).filter(isIncomplete);
        expect(incomplete.map((reading) => reading.check?.month)).toEqual([
          "Februar",
          "Juni",
          "Februar",
          "März",
        ]);
        // sdat of a complete month is 3x the esl difference
        const april = eslReadings(sensor, data).find(
          (reading) => reading.day === "2021-05-01",
        );
        expect(april?.check?.sdat).toBeCloseTo(3 * april!.check!.eslDiff, 0);
        expect(gapsIn({ from: "2021-02-01", to: "2021-02-28" }, data)).toEqual([
          { from: "2021-02-18", to: "2021-02-24" },
        ]);
      });
    },
  );
});
