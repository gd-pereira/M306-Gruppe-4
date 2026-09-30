import { describe, expect, it } from "vitest";
import {
  bucketTitle,
  localParts,
  xTicksFor,
} from "@/components/analysis/chart-axes";
import {
  eslAround,
  eslReadings,
  isIncomplete,
  METER_SCOPE,
  meterLine,
  meterRegions,
  rangeEnd,
  rangeStart,
  sourceSegments,
  USAGE_SCOPE,
  usageBuckets,
  usageRegions,
  usageTotals,
} from "@/components/analysis/fake-analysis";
import {
  breadcrumb,
  isoWeek,
  pagerLabel,
  periodFromParams,
  periodFromRange,
  periodOf,
  periodTitle,
  resolutionOf,
  shiftPeriod,
  switchLevel,
  type Period,
} from "@/components/analysis/period";
import { DATA_END, DATA_START } from "@/components/export/fake-export";

const april: Period = {
  level: "month",
  range: { from: "2021-04-01", to: "2021-04-30" },
};

describe("period", () => {
  it("finds the level of a range from the url", () => {
    expect(
      periodFromParams({ von: "2021-04-01", bis: "2021-04-30" }, USAGE_SCOPE),
    ).toEqual(april);
    expect(
      periodFromRange({ from: "2021-04-05", to: "2021-04-11" }, USAGE_SCOPE)
        .level,
    ).toBe("week");
    expect(
      periodFromRange({ from: "2021-04-11", to: "2021-04-11" }, USAGE_SCOPE)
        .level,
    ).toBe("day");
    // a year cut to the data still counts as the year
    expect(
      periodFromRange({ from: "2021-01-01", to: DATA_END }, USAGE_SCOPE),
    ).toEqual({
      level: "year",
      range: { from: "2021-01-01", to: "2021-12-31" },
    });
    // the whole export range is only part of the zählerstand (frame «aus Export»)
    expect(
      periodFromRange({ from: DATA_START, to: DATA_END }, METER_SCOPE).level,
    ).toBe("custom");
    expect(
      periodFromRange({ from: DATA_START, to: DATA_END }, USAGE_SCOPE).level,
    ).toBe("all");
  });

  it("keeps other ranges as a custom period and ignores broken parameters", () => {
    expect(
      periodFromRange({ from: "2020-03-05", to: "2020-11-20" }, USAGE_SCOPE),
    ).toEqual({
      level: "custom",
      range: { from: "2020-03-05", to: "2020-11-20" },
    });
    expect(
      periodFromParams({ von: "2021-05-01", bis: "2021-04-01" }, USAGE_SCOPE),
    ).toEqual({ level: "all", range: USAGE_SCOPE.all });
    expect(periodFromParams({ von: "kaputt" }, USAGE_SCOPE).level).toBe("all");
  });

  it("steps to the neighbour and stops at the edge of the data", () => {
    expect(shiftPeriod(april, 1, USAGE_SCOPE)?.range).toEqual({
      from: "2021-05-01",
      to: "2021-05-31",
    });
    const september = periodOf("month", "2021-09-01", USAGE_SCOPE);
    expect(shiftPeriod(september, 1, USAGE_SCOPE)).toBeNull();
    expect(shiftPeriod(september, 1, METER_SCOPE)?.range.from).toBe(
      "2021-10-01",
    );
    const first = periodOf("day", DATA_START, USAGE_SCOPE);
    expect(shiftPeriod(first, -1, USAGE_SCOPE)).toBeNull();
    expect(
      shiftPeriod({ level: "all", range: USAGE_SCOPE.all }, 1, USAGE_SCOPE),
    ).toBeNull();
  });

  it("keeps the place when the level changes", () => {
    expect(switchLevel(april, "day", USAGE_SCOPE).range.from).toBe(
      "2021-04-01",
    );
    expect(switchLevel(april, "week", USAGE_SCOPE).range).toEqual({
      from: "2021-03-29",
      to: "2021-04-04",
    });
    const all: Period = { level: "all", range: USAGE_SCOPE.all };
    expect(switchLevel(all, "month", USAGE_SCOPE).range.from).toBe(
      "2021-09-01",
    );
  });

  it("uses the resolution of the business rule", () => {
    const levels = ["day", "week", "month", "year", "all"] as const;
    expect(
      levels.map((level) =>
        resolutionOf(periodOf(level, "2021-04-07", USAGE_SCOPE)),
      ),
    ).toEqual(["15min", "hour", "day", "week", "month"]);
  });

  it("labels pager, title and breadcrumb like the mockup", () => {
    expect(pagerLabel(april)).toBe("April 2021");
    expect(pagerLabel(periodOf("day", "2021-04-11", USAGE_SCOPE))).toBe(
      "So, 11.04.2021",
    );
    expect(pagerLabel(periodOf("week", "2021-04-07", USAGE_SCOPE))).toBe(
      "KW 14 · 2021",
    );
    expect(pagerLabel({ level: "all", range: METER_SCOPE.all })).toBe(
      "2018 – 2022",
    );
    expect(
      periodTitle(periodOf("week", "2021-04-07", USAGE_SCOPE), USAGE_SCOPE),
    ).toBe("05.–11.04.2021");
    expect(
      breadcrumb(periodOf("week", "2021-04-07", USAGE_SCOPE), USAGE_SCOPE).map(
        (crumb) => crumb.label,
      ),
    ).toEqual(["Alles", "2021", "April", "KW 14"]);
    expect(isoWeek("2021-01-03")).toEqual({ week: 53, year: 2020 });
  });
});

describe("verbrauch data", () => {
  it("has one value per bucket of the resolution", () => {
    expect(usageBuckets(april.range, "day")).toHaveLength(30);
    expect(
      usageBuckets({ from: "2021-04-11", to: "2021-04-11" }, "15min"),
    ).toHaveLength(96);
    // the day the clocks go forward has 23 hours
    expect(
      usageBuckets({ from: "2021-03-28", to: "2021-03-28" }, "hour"),
    ).toHaveLength(23);
  });

  it("leaves gap days empty instead of bridging them", () => {
    const february = usageBuckets(
      { from: "2021-02-01", to: "2021-02-28" },
      "day",
    );
    const gap = february.filter((bucket) => bucket.consumption === null);
    expect(gap).toHaveLength(7);
    const months = usageBuckets(USAGE_SCOPE.all, "month");
    expect(months.find((m) => m.missingDays > 0)?.missingDays).toBe(1);
    // september 2021 is cut off by the end of sdat and left out
    expect(months).toHaveLength(44);
  });

  it("sums the same kWh on every resolution", () => {
    const days = usageBuckets(april.range, "day");
    const hours = usageBuckets(april.range, "hour");
    const total = (list: typeof days) =>
      list.reduce((sum, bucket) => sum + (bucket.consumption ?? 0), 0);
    expect(total(hours)).toBeCloseTo(total(days), 6);
    expect(usageTotals(april.range).consumption).toBeCloseTo(total(days), 6);
    expect(usageTotals(april.range).peak?.value).toBeGreaterThan(0);
  });

  it("marks the parts without sdat", () => {
    const september = usageRegions({ from: "2021-09-01", to: "2021-09-30" });
    expect(september).toHaveLength(1);
    expect(september[0].from).toBe(
      rangeStart({ from: "2021-09-07", to: "2021-09-07" }),
    );
    expect(usageRegions(april.range)).toHaveLength(0);
  });
});

describe("zählerstand data", () => {
  it("never goes negative and never falls", () => {
    for (const sensor of ["ID742", "ID735"] as const) {
      const line = meterLine(sensor, METER_SCOPE.all, "day");
      expect(line[0].value).toBeGreaterThan(0);
      for (let i = 1; i < line.length; i++) {
        expect(line[i].value).toBeGreaterThanOrEqual(line[i - 1].value);
      }
      const esl = eslReadings(sensor);
      for (let i = 1; i < esl.length; i++) {
        expect(esl[i].value).toBeGreaterThan(esl[i - 1].value);
      }
    }
  });

  it("has a reading on every first of the month from 2019 to 09.2022", () => {
    const esl = eslReadings("ID742");
    expect(esl[0].day).toBe("2019-01-01");
    expect(esl[esl.length - 1].day).toBe("2022-09-01");
    expect(esl).toHaveLength(45);
  });

  it("compares sdat with the esl difference, 3x when complete", () => {
    const esl = eslReadings("ID742");
    const may = esl.find((reading) => reading.day === "2021-05-01")!;
    expect(may.check?.sdat).toBeCloseTo(may.check!.eslDiff * 3, 6);
    const incomplete = esl.filter(isIncomplete).map((reading) => reading.day);
    expect(incomplete).toEqual([
      "2020-03-01",
      "2020-07-01",
      "2021-03-01",
      "2021-04-01",
    ]);
    const march = esl.find((reading) => reading.day === "2021-03-01")!;
    expect(march.check!.sdat!).toBeLessThan(march.check!.eslDiff * 3);
    expect(esl.find((r) => r.day === "2021-10-01")?.check?.sdat).toBeNull();
  });

  it("brings the readings around a short period for the line to the edges", () => {
    const around = eslAround("ID742", { from: "2021-04-11", to: "2021-04-11" });
    expect(around.map((reading) => reading.day)).toEqual([
      "2021-04-01",
      "2021-05-01",
    ]);
  });

  it("labels backcalculation and the end of sdat", () => {
    const regions = meterRegions(METER_SCOPE.all);
    expect(regions.map((region) => region.label)).toEqual([
      "Zurückgerechnet",
      "Keine SDAT-Daten",
    ]);
    expect(regions[1].to).toBe(rangeEnd(METER_SCOPE.all));
    expect(sourceSegments(METER_SCOPE.all).map((s) => s.kind)).toEqual([
      "backcalc",
      "measured",
      "eslOnly",
      "none",
    ]);
    expect(sourceSegments(april.range).map((s) => s.kind)).toEqual([
      "measured",
    ]);
  });
});

describe("axes", () => {
  it("formats times in swiss local time", () => {
    const ts = rangeStart({ from: "2021-04-07", to: "2021-04-07" });
    expect(localParts(ts)).toEqual({ day: "2021-04-07", time: "00:00" });
    expect(bucketTitle(ts, "day")).toBe("Mi, 07.04.2021");
    expect(bucketTitle(ts + 11 * 3600, "15min")).toBe("Mi, 07.04.2021, 11:00");
  });

  it("puts day marks under a month", () => {
    expect(xTicksFor(april.range, "day").map((tick) => tick.label)).toEqual([
      "1. Apr",
      "5. Apr",
      "10. Apr",
      "15. Apr",
      "20. Apr",
      "25. Apr",
      "30. Apr",
    ]);
  });
});
