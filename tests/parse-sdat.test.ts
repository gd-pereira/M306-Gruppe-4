import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSdat } from "@/lib/parse-sdat";
import type { Direction } from "@/lib/types";

function parseFixture(name: string) {
  return parseSdat(readFileSync(`tests/fixtures/${name}`, "utf-8"), name);
}

describe("parseSdat", () => {
  const cases: [string, Direction][] = [
    ["ID742", "consumption"],
    ["ID735", "feedIn"],
  ];

  it.each(cases)("%s is read as %s", (id, direction) => {
    const result = parseFixture(`sdat-${id}.xml`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { series } = result;
    expect(series.sensorId).toBe(id);
    expect(series.direction).toBe(direction);
    expect(series.kind).toBe("usage");
    expect(series.points).toHaveLength(96);

    // every value should be exactly 15 min (900 s) after the one before
    for (let i = 1; i < series.points.length; i++) {
      expect(series.points[i].ts - series.points[i - 1].ts).toBe(900);
    }
  });

  it("ID742: timestamps and values are correct", () => {
    const result = parseFixture("sdat-ID742.xml");
    if (!result.ok) throw new Error("ID742 should be readable");

    // values taken by hand from the fixture file
    const start = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000; // 2019-03-11T23:00:00Z
    const { points } = result.series;
    expect(points[0]).toEqual({ ts: start, value: 3 });
    expect(points[1]).toEqual({ ts: start + 900, value: 2.7 });
    expect(points[95]).toEqual({ ts: start + 95 * 900, value: 0.6 });
  });

  it("reads the creation date of the file", () => {
    const result = parseFixture("sdat-ID742.xml");
    if (!result.ok) throw new Error("file should be readable");

    // <rsm:Creation>2019-03-13T08:31:00Z</rsm:Creation>
    expect(result.series.createdAt).toBe(Date.UTC(2019, 2, 13, 8, 31) / 1000);
  });

  // condition 21 = placeholder 0, the client wants the real value from the newer file instead
  describe("placeholders (condition 21)", () => {
    const xml = readFileSync("tests/fixtures/sdat-ID742.xml", "utf-8");
    const placeholder = "</rsm:Volume><rsm:Condition>21</rsm:Condition>";

    it("are skipped", () => {
      // only the first observation becomes a placeholder
      const result = parseSdat(
        xml.replace("</rsm:Volume>", placeholder),
        "placeholder.xml",
      );
      if (!result.ok) throw new Error("file should be readable");

      const start = Date.UTC(2019, 2, 11, 23, 0, 0) / 1000;
      expect(result.series.points).toHaveLength(95);
      expect(result.series.points[0]).toEqual({ ts: start + 900, value: 2.7 });
      expect(result.placeholders).toBe(1);
    });

    it("a file with only placeholders is valid but empty", () => {
      const result = parseSdat(
        xml.replaceAll("</rsm:Volume>", placeholder),
        "only-placeholders.xml",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.series.points).toEqual([]);
      expect(result.placeholders).toBe(96);
    });

    it("other conditions (e.g. 56 = substitute value) are real values", () => {
      const result = parseSdat(
        xml.replace(
          "</rsm:Volume>",
          "</rsm:Volume><rsm:Condition>56</rsm:Condition>",
        ),
        "substitute-value.xml",
      );
      if (!result.ok) throw new Error("file should be readable");

      expect(result.series.points).toHaveLength(96);
      expect(result.placeholders).toBe(0);
    });
  });

  it("broken file gives an error instead of crashing", () => {
    const result = parseFixture("sdat-broken.xml");

    expect(result.ok).toBe(false);
    if (result.ok || !("error" in result)) throw new Error("error expected");
    expect(result.error.file).toBe("sdat-broken.xml");
    expect(result.error.message).toContain("Invalid XML");
  });

  // the client only wants ID742 and ID735, all others are ignored (not an error)
  it.each(["ID26256", "ID26257", "ID26263"])("%s is ignored", (id) => {
    const result = parseFixture(`sdat-${id}.xml`);

    expect(result).toEqual({
      ok: false,
      ignored: { file: `sdat-${id}.xml`, sensorId: id },
    });
  });

  it("DocumentID without sensor ID gives an error", () => {
    const xml = readFileSync("tests/fixtures/sdat-ID742.xml", "utf-8").replace(
      /_ID742</,
      "<",
    );
    const result = parseSdat(xml, "without-id.xml");

    expect(result).toEqual({
      ok: false,
      error: {
        file: "without-id.xml",
        message: "Sensor ID missing in DocumentID",
      },
    });
  });

  it("ESL file is not an SDAT file", () => {
    const result = parseFixture("esl-2019-01.xml");

    expect(result.ok).toBe(false);
  });
});
