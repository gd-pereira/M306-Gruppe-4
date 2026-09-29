import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// checks the fixture files themselves, not the parser

const sensorIds = ["ID742", "ID735", "ID26256", "ID26257"];

function readFixture(name: string): string {
  return readFileSync(`tests/fixtures/${name}`, "utf-8");
}

describe("SDAT fixtures", () => {
  it.each(sensorIds)("%s: open file, find sensor ID and 96 values", (id) => {
    const xml = readFixture(`sdat-${id}.xml`);

    expect(xml).toMatch(new RegExp(`<rsm:DocumentID>[^<]*_${id}<`));
    // a normal day has 24 * 4 = 96 values
    expect(xml.match(/<rsm:Observation>/g)).toHaveLength(96);
  });

  it("broken file is incomplete", () => {
    const xml = readFixture("sdat-broken.xml");

    // the file was cut off in the middle, so the closing tag is missing
    expect(xml).not.toContain("</rsm:ValidatedMeteredData_12>");
  });
});
