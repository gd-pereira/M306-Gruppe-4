import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importView } from "@/components/import/import-view";
import { pageList } from "@/components/import/pagination";
import { formatDate } from "@/lib/format";
import { addFile, buildResult, createParsedFiles } from "@/lib/import";

function importFrom(dir: string, names: string[]) {
  const parsed = createParsedFiles();
  for (const name of names) {
    addFile(parsed, name, readFileSync(`${dir}/${name}`, "utf-8"));
  }
  return buildResult(parsed);
}

describe("pageList", () => {
  it("shows every page up to 7", () => {
    expect(pageList(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shortens long lists around the current page", () => {
    expect(pageList(1, 518)).toEqual([1, 2, 3, "…", 518]);
    expect(pageList(3, 518)).toEqual([1, 2, 3, 4, "…", 518]);
    expect(pageList(200, 518)).toEqual([1, "…", 199, 200, 201, "…", 518]);
    expect(pageList(518, 518)).toEqual([1, "…", 516, 517, 518]);
  });
});

describe("importView", () => {
  const result = importFrom("tests/fixtures", [
    "sdat-ID742.xml",
    "sdat-ID735.xml",
    "esl-2019-01.xml",
    "esl-2019-03.xml",
    "sdat-ID26256.xml",
    "sdat-broken.xml",
  ]);
  const { files, summary } = importView(result);

  it("makes one row per file with sensor and direction", () => {
    expect(files.map((f) => [f.name, f.status])).toEqual([
      ["sdat-ID742.xml", "imported"],
      ["sdat-ID735.xml", "imported"],
      ["esl-2019-01.xml", "imported"],
      ["esl-2019-03.xml", "imported"],
      ["sdat-ID26256.xml", "ignored"],
      ["sdat-broken.xml", "error"],
    ]);
    expect(files[0]).toMatchObject({
      id: 0,
      type: "sdat",
      sensor: "ID742",
      direction: "consumption",
    });
    expect(files[1]).toMatchObject({ sensor: "ID735", direction: "feedIn" });
    expect(files[2]).toMatchObject({
      type: "esl",
      sensor: null,
      direction: "both",
    });
    expect(files[4]).toMatchObject({ sensor: "ID26256", direction: null });
    expect(files[5].message).toBeTruthy();
  });

  it("sums up the import", () => {
    expect(summary.values).toEqual({ consumption: 96, feedIn: 96 });
    expect(summary.eslFiles).toBe(2);
    expect(summary.ignoredSensors).toEqual(["ID26256"]);
    expect(summary.sdat?.end).toBe(
      result.consumption.usage["15min"][95].ts + 15 * 60,
    );
    expect(summary.period?.start).toBeLessThanOrEqual(summary.sdat!.start);
    expect(summary.kwh.consumption).toBeGreaterThan(0);
  });

  it("gives the same object for the same result", () => {
    expect(importView(result)).toBe(importView(result));
  });
});

describe("demo data", () => {
  const dir = "public/demo";
  const names: string[] = JSON.parse(
    readFileSync(`${dir}/files.json`, "utf-8"),
  );

  it("lists every file in the folder", () => {
    const xml = readdirSync(dir).filter((name) => name.endsWith(".xml"));
    expect([...names].sort()).toEqual(xml.sort());
  });

  it("has january 2021 for both meters, esl readings and ignored files", () => {
    const result = importFrom(dir, names);
    const { files, summary } = importView(result);
    expect(result.errors).toEqual([]);
    expect(files.filter((f) => f.status === "ignored")).toHaveLength(2);
    // 31 days with 96 values each
    expect(summary.values).toEqual({ consumption: 2976, feedIn: 2976 });
    expect(formatDate(summary.sdat!.start)).toBe("01.01.2021");
    expect(formatDate(summary.sdat!.end - 1)).toBe("31.01.2021");
    expect(summary.eslReadings.length).toBeGreaterThanOrEqual(2);
    expect(result.consumption.meterReading["15min"].length).toBe(2976);
  });
});
