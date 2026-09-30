import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildFile,
  csvLines,
  exportSeries,
  exportSummary,
  exportText,
  fileName,
  gapsInRange,
  readingsInRange,
  type ExportRequest,
  type ExportSeries,
} from "@/lib/export";
import { addFile, buildResult, createParsedFiles } from "@/lib/import";
import { INTERVAL } from "@/lib/timeseries";

// 2019-03-11T23:00:00Z, 00:00 swiss time on 12.03.2019
const T = 1552345200;

// readings at the end of every interval, the value goes up by 0.25 kWh
function series(
  sensorId: "ID742" | "ID735",
  count: number,
  skip: number[] = [],
): ExportSeries {
  const readings = [];
  for (let i = 1; i <= count; i++) {
    if (!skip.includes(i)) {
      readings.push({ ts: T + i * INTERVAL, value: 100 + i * 0.25 });
    }
  }
  // skipped readings i..j: the usage from interval i-1 to j is missing
  const gaps =
    skip.length > 0
      ? [
          {
            start: T + (skip[0] - 1) * INTERVAL,
            end: T + skip[skip.length - 1] * INTERVAL,
          },
        ]
      : [];
  return { sensorId, readings, gaps };
}

function request(
  format: "csv" | "json",
  list: ExportSeries[],
  from = T,
  to = T + 100 * INTERVAL,
): ExportRequest {
  return { format, series: list, from, to };
}

describe("readingsInRange", () => {
  const { readings } = series("ID742", 8);

  it("takes readings with from < ts <= to (a reading is the end of its interval)", () => {
    const inRange = readingsInRange(readings, T + INTERVAL, T + 3 * INTERVAL);
    expect(inRange.map((p) => p.ts)).toEqual([
      T + 2 * INTERVAL,
      T + 3 * INTERVAL,
    ]);
  });

  it("gives nothing outside the data", () => {
    expect(readingsInRange(readings, T - 10 * INTERVAL, T)).toEqual([]);
    expect(
      readingsInRange(readings, T + 8 * INTERVAL, T + 20 * INTERVAL),
    ).toEqual([]);
  });
});

describe("csv", () => {
  it("has the separator hint for excel, the header and one line per reading", () => {
    const text = exportText(request("csv", [series("ID742", 3)]));
    expect(text).toBe(
      [
        "sep=,",
        "timestamp,value",
        `${T + INTERVAL},100.25`,
        `${T + 2 * INTERVAL},100.5`,
        `${T + 3 * INTERVAL},100.75`,
        "",
      ].join("\n"),
    );
  });

  it("keeps up to 4 decimals and no float noise", () => {
    const lines = [
      ...csvLines(
        request("csv", [
          {
            sensorId: "ID742",
            readings: [
              { ts: T + INTERVAL, value: 3569.957312 },
              { ts: T + 2 * INTERVAL, value: 19216.199999999997 },
              { ts: T + 3 * INTERVAL, value: 100 },
            ],
            gaps: [],
          },
        ]),
      ),
    ];
    expect(lines.slice(2).map((line) => line.split(",")[1])).toEqual([
      "3569.9573",
      "19216.2",
      "100",
    ]);
  });

  it("leaves out the gap instead of writing zeros", () => {
    const lines = [...csvLines(request("csv", [series("ID742", 6, [3, 4])]))];
    expect(lines).toHaveLength(2 + 4);
    expect(lines.some((line) => line.endsWith(",0.0"))).toBe(false);
    expect(lines).not.toContain(`${T + 3 * INTERVAL},100.75`);
  });

  it("only uses the first sensor", () => {
    const text = exportText(
      request("csv", [series("ID742", 2), series("ID735", 5)]),
    );
    expect(text.trim().split("\n")).toHaveLength(4);
  });

  it("is named after the sensor", () => {
    expect(fileName("csv", "ID735")).toBe("ID735.csv");
    expect(fileName("json", "ID735")).toBe("zaehlerstaende.json");
  });
});

describe("json", () => {
  it("has the format of the project description, ts as string and value as number", () => {
    const text = exportText(
      request("json", [series("ID742", 2), series("ID735", 1)]),
    );
    expect(JSON.parse(text)).toEqual([
      {
        sensorId: "ID742",
        data: [
          { ts: String(T + INTERVAL), value: 100.25 },
          { ts: String(T + 2 * INTERVAL), value: 100.5 },
        ],
      },
      {
        sensorId: "ID735",
        data: [{ ts: String(T + INTERVAL), value: 100.25 }],
      },
    ]);
  });

  it("stays valid json when a sensor has no values in the range", () => {
    const text = exportText(
      request(
        "json",
        [series("ID742", 2), series("ID735", 2)],
        T + 10 * INTERVAL,
      ),
    );
    expect(JSON.parse(text)).toEqual([
      { sensorId: "ID742", data: [] },
      { sensorId: "ID735", data: [] },
    ]);
  });
});

describe("exportSummary", () => {
  it("counts values and bytes exactly like the real file", () => {
    for (const r of [
      request("csv", [series("ID742", 50, [10, 11, 12])]),
      request("json", [series("ID742", 50, [10, 11, 12]), series("ID735", 7)]),
      request(
        "json",
        [series("ID742", 3), series("ID735", 3)],
        T + 50 * INTERVAL,
      ),
    ]) {
      const summary = exportSummary(r);
      const text = exportText(r);
      expect(summary.bytes).toBe(text.length);
      expect(summary.values).toBe(
        r.format === "csv"
          ? text.trim().split("\n").length - 2
          : (JSON.parse(text) as { data: unknown[] }[]).reduce(
              (sum, s) => sum + s.data.length,
              0,
            ),
      );
    }
  });

  it("gives the first and last reading per sensor", () => {
    const summary = exportSummary(
      request("csv", [series("ID742", 8)], T + 2 * INTERVAL, T + 5 * INTERVAL),
    );
    expect(summary.readings.ID742).toEqual({ first: 100.75, last: 101.25 });
    expect(
      exportSummary(request("csv", [series("ID742", 2)], T + 5 * INTERVAL))
        .readings.ID742,
    ).toBeNull();
  });

  it("lists each gap only once and cuts it to the range", () => {
    const summary = exportSummary(
      request(
        "json",
        [series("ID742", 10, [4, 5]), series("ID735", 10, [4, 5])],
        T + 4 * INTERVAL,
      ),
    );
    expect(summary.gaps).toEqual([
      { start: T + 4 * INTERVAL, end: T + 5 * INTERVAL },
    ]);
  });
});

describe("gapsInRange", () => {
  it("drops gaps outside the range", () => {
    const gaps = [{ start: T, end: T + INTERVAL }];
    expect(gapsInRange(gaps, T + INTERVAL, T + 2 * INTERVAL)).toEqual([]);
  });
});

describe("buildFile", () => {
  it("gives the same text as exportText", async () => {
    const r = request("json", [series("ID742", 30), series("ID735", 30)]);
    const blob = await buildFile(r);
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe(exportText(r));
  });
});

// the whole way from the files to the csv, with the test files
describe("exportSeries", () => {
  const fixture = (name: string) =>
    readFileSync(`tests/fixtures/${name}`, "utf-8");
  const parsed = createParsedFiles();
  for (const name of [
    "sdat-ID742.xml",
    "sdat-ID735.xml",
    "esl-2019-01.xml",
    "esl-2019-03.xml",
  ]) {
    addFile(parsed, name, fixture(name));
  }
  const source = exportSeries(buildResult(parsed));

  it("maps bezug to ID742 and einspeisung to ID735", () => {
    expect(source.ID742.sensorId).toBe("ID742");
    expect(source.ID735.sensorId).toBe("ID735");
  });

  it("puts every reading at the end of its 15 min interval", () => {
    // the sdat day starts 2019-03-11T23:00:00Z, the first reading is 15 min later
    const { readings } = source.ID742;
    expect(readings).toHaveLength(96);
    expect(readings[0].ts).toBe(T + INTERVAL);
    expect(readings[95].ts).toBe(T + 96 * INTERVAL);
  });

  it("gives a csv with 96 lines that always go up", () => {
    const lines = [
      ...csvLines({
        format: "csv",
        series: [source.ID742],
        from: T,
        to: T + 96 * INTERVAL,
      }),
    ];
    expect(lines.slice(0, 2)).toEqual(["sep=,", "timestamp,value"]);
    expect(lines).toHaveLength(98);
    const values = lines.slice(2).map((line) => Number(line.split(",")[1]));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });
});
