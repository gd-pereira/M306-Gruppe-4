import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { addFile, createParsedFiles } from "@/lib/import";
import { fitMeterReadings, type MeterFit } from "@/lib/meter";
import { mergeSeries } from "@/lib/timeseries";
import type { DataPoint, Direction } from "@/lib/types";

// the whole test data (data/sdat and data/esl), reading it takes about 10 seconds
const data: Record<Direction, { esl: DataPoint[]; fit: MeterFit }> = {
  consumption: { esl: [], fit: { readings: [], ratio: 1, sources: [] } },
  feedIn: { esl: [], fit: { readings: [], ratio: 1, sources: [] } },
};

beforeAll(() => {
  const parsed = createParsedFiles();
  for (const dir of ["data/sdat", "data/esl"]) {
    for (const name of readdirSync(dir)) {
      addFile(parsed, name, readFileSync(path.join(dir, name), "utf8"));
    }
  }

  for (const direction of ["consumption", "feedIn"] as const) {
    const usage = mergeSeries(
      parsed.sdat.filter((s) => s.direction === direction),
    );
    const esl = mergeSeries(
      parsed.esl.filter((s) => s.direction === direction),
    );
    data[direction] = { esl, fit: fitMeterReadings(usage, esl) };
  }
}, 60_000);

describe.each(["consumption", "feedIn"] as const)(
  "meter reading %s",
  (direction) => {
    it("hits every ESL reading while there is sdat", () => {
      const { esl, fit } = data[direction];
      const byTs = new Map(fit.readings.map((p) => [p.ts, p.value]));
      const hit = esl.filter((reading) => byTs.has(reading.ts));

      // 01.01.2019 to 01.09.2021, the later ones are after sdat ends
      expect(hit).toHaveLength(33);
      for (const reading of hit) {
        expect(byTs.get(reading.ts)).toBe(reading.value);
      }
    });

    it("always goes up and is never negative", () => {
      const { readings } = data[direction].fit;

      expect(readings[0].value).toBeGreaterThan(0);
      for (let i = 1; i < readings.length; i++) {
        expect(readings[i].value).toBeGreaterThanOrEqual(readings[i - 1].value);
      }
    });

    it("uses sdat ÷ 3.00 before the first ESL reading", () => {
      expect(data[direction].fit.ratio).toBe(3);
    });

    it("2018 is backcalc, then measured, after 06.09.2021 only ESL", () => {
      // swiss time: +01:00 in winter, +02:00 in summer
      const at = (iso: string) => Date.parse(iso) / 1000;
      const sdatStart = at("2018-01-01T00:00+01:00");
      const firstEsl = at("2019-01-01T00:00+01:00");
      const sdatEnd = at("2021-09-07T00:00+02:00");
      const lastEsl = at("2022-09-01T00:00+02:00");

      expect(data[direction].fit.sources).toEqual([
        { source: "backcalc", start: sdatStart, end: firstEsl },
        { source: "measured", start: firstEsl, end: sdatEnd },
        { source: "eslOnly", start: sdatEnd, end: lastEsl },
      ]);
    });
  },
);

it("start and end values like in the mockups", () => {
  const consumption = data.consumption.fit.readings;
  const feedIn = data.feedIn.fit.readings;

  // first reading 01.01.2018 00:15, the mockup rounds it to 3'570.0
  expect(consumption[0].value).toBeCloseTo(3570, 0);
  expect(feedIn[0].value).toBe(6435.3);

  // last reading 07.09.2021 00:00 = end of 06.09.2021
  expect(consumption.at(-1)?.value).toBe(54435.3);
  expect(feedIn.at(-1)?.value).toBe(23367.1);
});
