import { beforeEach, describe, expect, it } from "vitest";
import { createSession, isValidSession, SESSION_SECONDS } from "@/lib/session";

const PASSWORD = "test-passwort";

beforeEach(() => {
  process.env.ADMIN_PASSWORD = PASSWORD;
});

describe("session", () => {
  it("accepts a fresh token", async () => {
    expect(await isValidSession(await createSession(PASSWORD))).toBe(true);
  });

  it("gives every login a different token", async () => {
    expect(await createSession(PASSWORD)).not.toBe(
      await createSession(PASSWORD),
    );
  });

  it("rejects a token after it ran out", async () => {
    const now = Date.now();
    const token = await createSession(PASSWORD, now);
    expect(
      await isValidSession(token, now + (SESSION_SECONDS - 1) * 1000),
    ).toBe(true);
    expect(await isValidSession(token, now + SESSION_SECONDS * 1000)).toBe(
      false,
    );
  });

  it("rejects a token signed with another password", async () => {
    expect(await isValidSession(await createSession("anderes"))).toBe(false);
  });

  it("rejects a token with a changed expiry", async () => {
    const [nonce, , signature] = (await createSession(PASSWORD)).split(".");
    expect(await isValidSession(`${nonce}.9999999999.${signature}`)).toBe(
      false,
    );
  });

  it("rejects broken cookies and a missing password", async () => {
    for (const cookie of [
      undefined,
      "",
      "abc",
      "a.b.c",
      "a.1.zz",
      "a.1.00.x",
    ]) {
      expect(await isValidSession(cookie)).toBe(false);
    }
    const token = await createSession(PASSWORD);
    delete process.env.ADMIN_PASSWORD;
    expect(await isValidSession(token)).toBe(false);
  });
});
