import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { addFile, buildResult, createParsedFiles } from "@/lib/import";

// reads the fixture files like the worker does and returns the result
function importFixtures(names: string[]) {
  const parsed = createParsedFiles();
  for (const name of names) {
    addFile(parsed, name, readFileSync(`tests/fixtures/${name}`, "utf-8"));
  }
  return buildResult(parsed);
}

describe("import", () => {
  it("sorts the files into SDAT, ESL, ignored and errors", () => {
    const result = importFixtures([
      "sdat-ID742.xml",
      "sdat-ID735.xml",
      "esl-2019-01.xml",
      "esl-2019-03.xml",
      "sdat-ID26256.xml",
      "sdat-broken.xml",
    ]);

    expect(result.stats).toEqual({
      sdatFiles: 2,
      eslFiles: 2,
      placeholders: 0,
      duplicates: 0,
    });
    expect(result.ignored).toEqual([
      { file: "sdat-ID26256.xml", sensorId: "ID26256" },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe("sdat-broken.xml");
    expect(result.consumption.valueCount).toBe(96);
    expect(result.feedIn.valueCount).toBe(96);
  });

  it("the same file twice gives 96 duplicates", () => {
    const result = importFixtures(["sdat-ID742.xml", "sdat-ID742.xml"]);

    expect(result.stats.duplicates).toBe(96);
    expect(result.consumption.valueCount).toBe(96);
  });

  it("meter reading starts at the nearest ESL reading", () => {
    const result = importFixtures([
      "sdat-ID742.xml",
      "esl-2019-01.xml",
      "esl-2019-03.xml",
    ]);
    const { esl, meterReading } = result.consumption;

    // the sdat day is 12.03.2019, the closest esl reading is 01.03.2019 (the last one)
    // the first 15 min value of the day is 3 kWh
    expect(esl).toHaveLength(3);
    expect(meterReading["15min"]).toHaveLength(96);
    expect(meterReading["15min"][0].value).toBe(esl[2].value + 3);
  });

  it("all zoom levels are precalculated", () => {
    const result = importFixtures(["sdat-ID742.xml"]);
    const { usage } = result.consumption;

    expect(usage["15min"]).toHaveLength(96);
    expect(usage.hour).toHaveLength(24);
    expect(usage.day).toHaveLength(1);
  });

  it("unknown file gives an error instead of crashing", () => {
    const parsed = createParsedFiles();
    addFile(parsed, "notes.txt", "hello");

    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].file).toBe("notes.txt");
  });

  it("lists every file with type, sensor, direction, start and status", () => {
    const result = importFixtures([
      "sdat-ID742.xml",
      "esl-2019-01.xml",
      "sdat-ID26256.xml",
      "sdat-broken.xml",
    ]);

    expect(result.files).toEqual([
      {
        file: "sdat-ID742.xml",
        type: "sdat",
        sensorIds: ["ID742"],
        directions: ["consumption"],
        from: result.consumption.usage["15min"][0].ts,
        status: "imported",
      },
      {
        file: "esl-2019-01.xml",
        type: "esl",
        sensorIds: ["ID742", "ID735"],
        directions: ["consumption", "feedIn"],
        from: result.consumption.esl[0].ts,
        status: "imported",
      },
      {
        file: "sdat-ID26256.xml",
        type: "sdat",
        sensorIds: ["ID26256"],
        directions: [],
        from: null,
        status: "ignored",
      },
      {
        file: "sdat-broken.xml",
        type: "sdat",
        sensorIds: [],
        directions: [],
        from: null,
        status: "error",
        message: result.errors[0].message,
      },
    ]);
  });

  it("a file whose values all came before is a duplicate", () => {
    const result = importFixtures(["sdat-ID742.xml", "sdat-ID742.xml"]);

    // same creation date, so the file read first keeps its values
    expect(result.files.map((f) => f.status)).toEqual([
      "imported",
      "duplicate",
    ]);
  });

  it("a file that is not xml has no type", () => {
    const parsed = createParsedFiles();
    addFile(parsed, "notes.txt", "hello");

    expect(buildResult(parsed).files[0]).toMatchObject({
      type: null,
      status: "error",
    });
  });

  it("no files give an empty result", () => {
    const result = importFixtures([]);

    expect(result.stats).toEqual({
      sdatFiles: 0,
      eslFiles: 0,
      placeholders: 0,
      duplicates: 0,
    });
    expect(result.consumption.meterReading["15min"]).toEqual([]);
  });
});
