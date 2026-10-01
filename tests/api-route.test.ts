import { beforeAll, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/zaehlerstaende/route";
import { createSession, SESSION_COOKIE } from "@/lib/session";

const PASSWORD = "test-passwort";
let cookie = "";

beforeAll(async () => {
  process.env.ADMIN_PASSWORD = PASSWORD;
  cookie = `${SESSION_COOKIE}=${await createSession(PASSWORD)}`;
});

function post(body: string, headers: Record<string, string> = { cookie }) {
  return new Request("http://localhost:3000/api/zaehlerstaende", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("API Route /api/zaehlerstaende", () => {
  it("accepts a valid JSON export array and returns 201 Created", async () => {
    const payload = [
      {
        sensorId: "ID742",
        data: [
          { ts: "1552348800", value: 100.5 },
          { ts: "1552349700", value: 101.0 },
        ],
      },
      {
        sensorId: "ID735",
        data: [{ ts: "1552348800", value: 50.2 }],
      },
    ];

    const res = await POST(post(JSON.stringify(payload)));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalValues).toBe(3);
    expect(body.sensors).toEqual(["ID742", "ID735"]);
  });

  it("rejects non-array payloads with 400 Bad Request", async () => {
    const res = await POST(post(JSON.stringify({ message: "invalid" })));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Array");
  });

  it("serves plain JSON on GET request", async () => {
    const res = await GET(
      new Request("http://localhost:3000/api/zaehlerstaende", {
        headers: { cookie },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const json = await res.json();
    expect(json.status).toBe("received");
    expect(json.totalValues).toBe(3);
    expect(json.data).toHaveLength(2);
  });

  it("answers 401 without a session", async () => {
    expect((await POST(post("[]", {}))).status).toBe(401);
    expect(
      (await GET(new Request("http://localhost:3000/api/zaehlerstaende")))
        .status,
    ).toBe(401);
    const forged = `${SESSION_COOKIE}=abc.9999999999.${"0".repeat(64)}`;
    expect((await POST(post("[]", { cookie: forged }))).status).toBe(401);
  });

  it("answers 413 for a body over 16 MB", async () => {
    const res = await POST(post("x".repeat(16 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
  });
});
