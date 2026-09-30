import { describe, expect, it } from "vitest";
import { formatNumber } from "@/lib/format";

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
