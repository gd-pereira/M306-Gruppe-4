import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SensorId } from "@/lib/types";

const sensorIds: SensorId[] = ["ID742", "ID735", "ID26256", "ID26257"];

function readFixture(name: string): string {
  return readFileSync(`tests/fixtures/${name}`, "utf-8");
}

describe("SDAT-Testdateien", () => {
  it.each(sensorIds)(
    "%s: Datei öffnen, Sensor-ID und 96 Messwerte finden",
    (id) => {
      const xml = readFixture(`sdat-${id}.xml`);

      expect(xml).toMatch(new RegExp(`<rsm:DocumentID>[^<]*_${id}<`));
      expect(xml.match(/<rsm:Observation>/g)).toHaveLength(96);
    },
  );

  it("kaputte Datei ist unvollständig", () => {
    const xml = readFixture("sdat-kaputt.xml");

    expect(xml).not.toContain("</rsm:ValidatedMeteredData_12>");
  });
});
