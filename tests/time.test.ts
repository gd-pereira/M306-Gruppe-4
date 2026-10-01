import { describe, expect, it } from "vitest";
import { zurichToUnix } from "@/lib/time";

const utc = (iso: string) => Date.parse(iso) / 1000;

describe("zurichToUnix", () => {
  it("reads winter and summer times with the right offset", () => {
    expect(zurichToUnix("2019-03-01T00:00:00")).toBe(
      utc("2019-02-28T23:00:00Z"),
    );
    expect(zurichToUnix("2019-07-01T12:00:00")).toBe(
      utc("2019-07-01T10:00:00Z"),
    );
  });

  it("handles the hour before the clocks go forward (31.03.2019)", () => {
    expect(zurichToUnix("2019-03-31T00:00:00")).toBe(
      utc("2019-03-30T23:00:00Z"),
    );
    expect(zurichToUnix("2019-03-31T01:30:00")).toBe(
      utc("2019-03-31T00:30:00Z"),
    );
    expect(zurichToUnix("2019-03-31T03:00:00")).toBe(
      utc("2019-03-31T01:00:00Z"),
    );
  });

  it("handles the hour before the clocks go back (27.10.2019)", () => {
    expect(zurichToUnix("2019-10-27T00:00:00")).toBe(
      utc("2019-10-26T22:00:00Z"),
    );
    expect(zurichToUnix("2019-10-27T01:30:00")).toBe(
      utc("2019-10-26T23:30:00Z"),
    );
    expect(zurichToUnix("2019-10-27T04:00:00")).toBe(
      utc("2019-10-27T03:00:00Z"),
    );
  });

  it("returns NaN for invalid input", () => {
    expect(zurichToUnix("")).toBeNaN();
    expect(zurichToUnix("kein datum")).toBeNaN();
  });
});
