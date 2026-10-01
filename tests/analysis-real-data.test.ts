import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  eslReadings,
  gapsIn,
  isIncomplete,
  meterLine,
  realAnalysisData,
  USAGE_SCOPE,
  usageBuckets,
  usageTotals,
  valueCount,
  type AnalysisData,
} from "@/components/analysis/fake-analysis";
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

beforeAll(() => {
  const parsed = createParsedFiles();
  for (const dir of ["data/sdat", "data/esl"]) {
    for (const name of readdirSync(dir)) {
      addFile(parsed, name, readFileSync(path.join(dir, name), "utf8"));
    }
  }
  result = buildResult(parsed);
  data = realAnalysisData(result);
}, 60_000);

const all = USAGE_SCOPE.data;

describe("real analysis data", () => {
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
