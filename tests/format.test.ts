import { describe, expect, it } from "vitest";
import { formatDate, formatNumber } from "@/lib/format";

describe("formatNumber", () => {
  it("groups thousands with a typographic apostrophe", () => {
    expect(formatNumber(5180)).toBe("5’180");
    expect(formatNumber(151412)).toBe("151’412");
    expect(formatNumber(1234567)).toBe("1’234’567");
    expect(formatNumber(999)).toBe("999");
  });

  it("rounds to the given decimals", () => {
    expect(formatNumber(46941.62, 1)).toBe("46’941.6");
    expect(formatNumber(7.2, 1)).toBe("7.2");
    expect(formatNumber(12837, 1)).toBe("12’837.0");
  });

  it("keeps the sign but never shows -0", () => {
    expect(formatNumber(-2500)).toBe("-2’500");
    expect(formatNumber(-0.2)).toBe("0");
  });
});

describe("formatDate", () => {
  it("shows the day in zurich as dd.mm.yyyy", () => {
    expect(formatDate(Date.UTC(2018, 0, 1) / 1000)).toBe("01.01.2018");
    expect(formatDate(Date.UTC(2021, 8, 6, 12) / 1000)).toBe("06.09.2021");
  });

  it("uses zurich time, not utc", () => {
    // 23:30 utc on 31.12. is already 00:30 on 01.01. in zurich
    expect(formatDate(Date.UTC(2020, 11, 31, 23, 30) / 1000)).toBe(
      "01.01.2021",
    );
  });
});
