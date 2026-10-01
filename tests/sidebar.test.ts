import { describe, expect, it } from "vitest";
import { NAV_ITEMS, shortcutOf } from "@/components/app-shell/nav";
import {
  addRecent,
  MAX_RECENT,
  parseRecent,
  periodLabel,
  viewFromLocation,
  type RecentView,
} from "@/components/app-shell/recent-views";
import {
  createGoSequence,
  isPaletteShortcut,
  isTypingTarget,
} from "@/components/app-shell/shortcuts";

describe("periodLabel", () => {
  it("names whole months and years", () => {
    expect(periodLabel({ from: "2021-03-01", to: "2021-03-31" })).toBe(
      "März 2021",
    );
    expect(periodLabel({ from: "2020-02-01", to: "2020-02-29" })).toBe(
      "Februar 2020",
    );
    expect(periodLabel({ from: "2019-01-01", to: "2019-12-31" })).toBe("2019");
    expect(periodLabel({ from: "2018-01-01", to: "2020-12-31" })).toBe(
      "2018 – 2020",
    );
  });

  it("writes the full data range like figma", () => {
    expect(periodLabel({ from: "2018-01-01", to: "2021-09-06" })).toBe(
      "2018 – 06.09.2021",
    );
  });

  it("falls back to day ranges", () => {
    expect(periodLabel({ from: "2021-09-06", to: "2021-09-06" })).toBe(
      "06.09.2021",
    );
    expect(periodLabel({ from: "2020-06-14", to: "2020-06-15" })).toBe(
      "14.–15.06.2020",
    );
    expect(periodLabel({ from: "2021-01-01", to: "2021-09-06" })).toBe(
      "01.01.–06.09.2021",
    );
  });
});

describe("viewFromLocation", () => {
  it("names exports after the file", () => {
    expect(
      viewFromLocation("/export", "sensor=ID742&von=2018-01-01&bis=2021-09-06"),
    ).toEqual({
      page: "export",
      label: "ID742.csv",
      href: "/export?sensor=ID742&von=2018-01-01&bis=2021-09-06",
    });
    // json has both sensors in one file, named like the download
    expect(viewFromLocation("/export", "sensor=ID735&format=json")?.label).toBe(
      "zaehlerstaende.json",
    );
    expect(viewFromLocation("/export", "modus=api")?.label).toBe(
      "An API senden",
    );
  });

  it("names period views after the period", () => {
    expect(
      viewFromLocation("/verbrauch", "von=2021-03-01&bis=2021-03-31"),
    ).toEqual({
      page: "verbrauch",
      label: "März 2021",
      href: "/verbrauch?von=2021-03-01&bis=2021-03-31",
    });
    expect(viewFromLocation("/zaehlerstand", "")).toEqual({
      page: "zaehlerstand",
      label: "Gesamter Zeitraum",
      href: "/zaehlerstand",
    });
    expect(
      viewFromLocation("/verbrauch", "von=2021-03-31&bis=2021-03-01")?.label,
    ).toBe("Gesamter Zeitraum");
  });

  it("ignores pages without a period", () => {
    expect(viewFromLocation("/dashboard", "")).toBeNull();
    expect(viewFromLocation("/import", "")).toBeNull();
  });
});

describe("addRecent", () => {
  const march: RecentView = {
    page: "verbrauch",
    label: "März 2021",
    href: "/verbrauch?von=2021-03-01&bis=2021-03-31",
  };
  const file: RecentView = {
    page: "export",
    label: "ID742.csv",
    href: "/export?sensor=ID742",
  };

  it("puts the newest first and keeps three", () => {
    let list: RecentView[] = [];
    for (const label of ["2018", "2019", "2020", "2021"]) {
      list = addRecent(list, { page: "verbrauch", label, href: `/v?${label}` });
    }
    expect(list.map((view) => view.label)).toEqual(["2021", "2020", "2019"]);
    expect(list).toHaveLength(MAX_RECENT);
  });

  it("moves a repeated view up instead of adding it twice", () => {
    const list = addRecent(addRecent([march], file), march);
    expect(list).toEqual([march, file]);
  });

  it("updates the link when the same export changes its range", () => {
    const moved = { ...file, href: "/export?sensor=ID742&von=2019-01-01" };
    expect(addRecent([file, march], moved)).toEqual([moved, march]);
  });

  it("returns the same list when nothing changes", () => {
    const list = [march, file];
    expect(addRecent(list, march)).toBe(list);
  });
});

describe("parseRecent", () => {
  it("drops broken storage values", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent('{"page":"export"}')).toEqual([]);
    expect(
      parseRecent(
        JSON.stringify([
          { page: "export", label: "ID742.csv", href: "/export" },
          { page: "admin", label: "x", href: "/admin" },
          { page: "export", label: "x", href: "https://evil.example" },
        ]),
      ),
    ).toEqual([{ page: "export", label: "ID742.csv", href: "/export" }]);
  });
});

describe("shortcuts", () => {
  it("gives every nav item its own letter", () => {
    const keys = NAV_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(NAV_ITEMS.map(shortcutOf)).toEqual([
      "G D",
      "G V",
      "G Z",
      "G I",
      "G E",
    ]);
  });

  it("matches G and a letter within a second", () => {
    const next = createGoSequence();
    expect(next("g", 0)).toBeNull();
    expect(next("v", 400)?.href).toBe("/verbrauch");
    expect(next("G", 1000)).toBeNull();
    expect(next("E", 1200)?.href).toBe("/export");
  });

  it("forgets the G after the timeout or another key", () => {
    const next = createGoSequence();
    next("g", 0);
    expect(next("d", 1500)).toBeNull();
    next("g", 2000);
    next("x", 2100);
    expect(next("d", 2200)).toBeNull();
  });

  it("re-arms on a second G", () => {
    const next = createGoSequence();
    next("g", 0);
    next("g", 300);
    expect(next("z", 600)?.href).toBe("/zaehlerstand");
  });

  it("knows the palette shortcut and typing targets", () => {
    const key = { ctrlKey: false, metaKey: false, altKey: false };
    expect(isPaletteShortcut({ ...key, key: "k", ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...key, key: "K", metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...key, key: "k" })).toBe(false);
    expect(
      isPaletteShortcut({ ...key, key: "k", ctrlKey: true, altKey: true }),
    ).toBe(false);

    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(
      true,
    );
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
