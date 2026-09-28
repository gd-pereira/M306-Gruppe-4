import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detectDateityp } from "@/lib/detect";

function readFixture(name: string): string {
  return readFileSync(`tests/fixtures/${name}`, "utf-8");
}

describe("detectDateityp", () => {
  // ID26263 can't be parsed, but it's still an sdat file
  it.each([
    "sdat-ID742.xml",
    "sdat-ID735.xml",
    "sdat-ID26256.xml",
    "sdat-ID26257.xml",
    "sdat-ID26263.xml",
  ])("%s ist SDAT", (datei) => {
    expect(detectDateityp(readFixture(datei))).toBe("sdat");
  });

  it.each(["esl-2019-01.xml", "esl-2019-03.xml"])("%s ist ESL", (datei) => {
    expect(detectDateityp(readFixture(datei))).toBe("esl");
  });

  it("kaputte Datei ergibt null", () => {
    expect(detectDateityp(readFixture("sdat-kaputt.xml"))).toBeNull();
  });

  it("unbekanntes XML ergibt null", () => {
    // valid xml, but neither sdat nor esl
    expect(detectDateityp("<andere><x>1</x></andere>")).toBeNull();
  });
});
