import { describe, expect, it } from "vitest";
import {
  buildFakeResult,
  demoFiles,
  fakeRow,
} from "@/components/import/fake-import";
import { pageList } from "@/components/import/pagination";

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

describe("fakeRow", () => {
  it("reads type, sensor and day from real file names", () => {
    const sdat = fakeRow(
      {
        name: "20190314_093133_12X-0000001216-O_E66_12X-LIPPUNEREM-T_ESLEVU122008_691763378.xml",
        size: 1,
      },
      0,
    );
    expect(sdat).toMatchObject({
      type: "sdat",
      sensor: "ID742",
      direction: "consumption",
      status: "imported",
      from: Date.UTC(2019, 2, 13) / 1000,
    });

    const esl = fakeRow(
      {
        name: "EdmRegisterWertExport_20190403_eslevu_20190403050446.xml",
        size: 1,
      },
      1,
    );
    expect(esl).toMatchObject({ type: "esl", direction: "both" });
  });

  it("ignores other sensors and flags broken files", () => {
    expect(fakeRow({ name: "sdat-ID26256.xml", size: 1 }, 0).status).toBe(
      "ignored",
    );
    expect(fakeRow({ name: "sdat-broken.xml", size: 1 }, 0)).toMatchObject({
      status: "error",
      type: "sdat",
    });
    expect(fakeRow({ name: "notes.xml", size: 1 }, 0).status).toBe("error");
  });
});

describe("demo data", () => {
  it("has both meters, a gap, esl readings and ignored files", () => {
    const { files, summary } = buildFakeResult(demoFiles());
    expect(files.some((f) => f.status === "ignored")).toBe(true);
    expect(summary.values.consumption).toBeGreaterThan(0);
    expect(summary.values.feedIn).toBeGreaterThan(0);
    expect(summary.sdat?.gaps).toHaveLength(1);
    expect(summary.gapDays).toBe(2);
    expect(summary.eslReadings).toHaveLength(2);
  });
});
