import { describe, expect, it } from "vitest";
import {
  axisLabels,
  buildFile,
  DATA_END,
  DATA_START,
  exportStats,
  formatBytes,
  formatDayRange,
  isDayKey,
  preview,
  PRESETS,
  yTicks,
  type ExportSelection,
} from "@/components/export/fake-export";
import {
  meterHref,
  selectionFromParams,
  selectionParams,
} from "@/components/export/selection";

const all = { from: DATA_START, to: DATA_END };
const csv: ExportSelection = { format: "csv", sensor: "ID742", range: all };
const json: ExportSelection = { format: "json", sensor: "ID742", range: all };

describe("exportStats", () => {
  it("matches the numbers of the figma frames", () => {
    const stats = exportStats(csv);
    expect(stats.fileName).toBe("ID742.csv");
    expect(stats.values).toBe(128_060);
    expect(stats.readings.ID742?.first.toFixed(1)).toBe("3570.0");
    expect(stats.readings.ID742?.last.toFixed(1)).toBe("54435.3");
    expect(formatBytes(stats.bytes)).toBe("2.4 MB");
    expect(stats.gaps.map(formatDayRange)).toEqual([
      "09.02.2020",
      "14.–15.06.2020",
      "18.–24.02.2021",
      "27.03.2021",
    ]);
  });

  it("counts both sensors for json", () => {
    const stats = exportStats(json);
    expect(stats.fileName).toBe("zaehlerstaende.json");
    expect(stats.values).toBe(256_120);
    expect(formatBytes(stats.bytes)).toBe("9.2 MB");
    expect(stats.readings.ID735?.last.toFixed(1)).toBe("23367.0");
  });

  it("only keeps the gaps inside the range", () => {
    const stats = exportStats({
      ...csv,
      range: { from: "2021-02-20", to: "2021-03-31" },
    });
    expect(stats.gaps.map(formatDayRange)).toEqual([
      "20.–24.02.2021",
      "27.03.2021",
    ]);
  });
});

describe("file content", () => {
  // a short range keeps the test fast, the byte count uses the same line format
  const short = { from: "2020-02-08", to: "2020-02-10" };

  it("writes csv with a header and unix seconds at the end of the interval", async () => {
    const text = await (await buildFile({ ...csv, range: short })).text();
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("timestamp,value");
    // 3 days minus the gap day, 96 values each
    expect(lines).toHaveLength(1 + 2 * 96);
    expect(text.length).toBe(exportStats({ ...csv, range: short }).bytes);
  });

  it("writes valid json with ts as string and the size matches", async () => {
    const selection = { ...json, range: short };
    const text = await (await buildFile(selection)).text();
    const parsed = JSON.parse(text) as {
      sensorId: string;
      data: { ts: string; value: number }[];
    }[];
    expect(parsed.map((entry) => entry.sensorId)).toEqual(["ID742", "ID735"]);
    expect(typeof parsed[0].data[0].ts).toBe("string");
    expect(parsed[0].data).toHaveLength(2 * 96);
    expect(text.length).toBe(exportStats(selection).bytes);
  });

  it("starts the id742 export like the mockup", () => {
    const stats = exportStats(csv);
    const { lines, remaining } = preview(csv, stats, 26);
    expect(lines[0]).toBe("timestamp,value");
    expect(lines[1]).toBe("1514762100,3570.0");
    expect(remaining).toBe(128_035);
  });

  it("shows seven values per sensor in a json preview of 25 rows", () => {
    const { remaining, unit } = preview(json, exportStats(json), 25);
    expect(unit).toBe("Werte");
    expect(remaining).toBe(256_106);
  });
});

describe("url parameters", () => {
  it("reads the parameters of the zählerstand link", () => {
    expect(
      selectionFromParams({
        sensor: "ID735",
        von: "2019-01-01",
        bis: "2019-12-31",
      }),
    ).toEqual({
      format: "csv",
      sensor: "ID735",
      range: { from: "2019-01-01", to: "2019-12-31" },
    });
  });

  it("falls back to the defaults and clamps to the data range", () => {
    expect(
      selectionFromParams({
        sensor: "ID26256",
        von: "2010-05-05",
        bis: "kaputt",
        format: "json",
      }),
    ).toEqual({
      format: "json",
      sensor: "ID742",
      range: { from: DATA_START, to: DATA_END },
    });
  });

  it("links to the zählerstand with the same settings", () => {
    expect(meterHref(csv)).toBe(
      "/zaehlerstand?sensor=ID742&von=2018-01-01&bis=2021-09-06&quelle=export",
    );
    expect(
      selectionFromParams(Object.fromEntries(selectionParams(json))),
    ).toEqual(json);
  });
});

describe("helpers", () => {
  it("validates day keys", () => {
    expect(isDayKey("2020-02-29")).toBe(true);
    expect(isDayKey("2021-02-29")).toBe(false);
    expect(isDayKey("01.01.2018")).toBe(false);
  });

  it("has presets inside the data range", () => {
    for (const preset of PRESETS) {
      expect(preset.range.from >= DATA_START).toBe(true);
      expect(preset.range.to <= DATA_END).toBe(true);
    }
    expect(PRESETS.find((p) => p.id === "30d")?.range.from).toBe("2021-08-08");
  });

  it("picks round ticks like the mockup", () => {
    expect(yTicks(54_435, 2)).toEqual([0, 30_000, 60_000]);
    expect(yTicks(54_435, 3)).toEqual([0, 20_000, 40_000, 60_000]);
  });

  it("zooms the axis when the values sit far above zero", () => {
    expect(yTicks(54_435, 2, 53_589)).toEqual([53_500, 54_000, 54_500]);
    expect(yTicks(54_435, 2, 23_367)).toEqual([0, 30_000, 60_000]);
  });

  it("labels years, months or days depending on the range", () => {
    expect(axisLabels(all).labels.map((l) => l.label)).toEqual([
      "2018",
      "2019",
      "2020",
      "2021",
    ]);
    expect(
      axisLabels({ from: "2020-01-01", to: "2020-03-31" }).labels.map(
        (l) => l.label,
      ),
    ).toEqual(["Jan", "Feb", "Mär"]);
    expect(
      axisLabels({ from: "2021-08-08", to: DATA_END }).labels[0].label,
    ).toBe("08.08.");
  });
});
