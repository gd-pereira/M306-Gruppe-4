import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/detect";

function readFixture(name: string): string {
  return readFileSync(`tests/fixtures/${name}`, "utf-8");
}

describe("detectFileType", () => {
  // ID26263 can't be parsed, but it's still an sdat file
  it.each([
    "sdat-ID742.xml",
    "sdat-ID735.xml",
    "sdat-ID26256.xml",
    "sdat-ID26257.xml",
    "sdat-ID26263.xml",
  ])("%s is SDAT", (file) => {
    expect(detectFileType(readFixture(file))).toBe("sdat");
  });

  it.each(["esl-2019-01.xml", "esl-2019-03.xml"])("%s is ESL", (file) => {
    expect(detectFileType(readFixture(file))).toBe("esl");
  });

  it("broken file gives null", () => {
    expect(detectFileType(readFixture("sdat-broken.xml"))).toBeNull();
  });

  it("unknown XML gives null", () => {
    // valid xml, but neither sdat nor esl
    expect(detectFileType("<other><x>1</x></other>")).toBeNull();
  });
});
