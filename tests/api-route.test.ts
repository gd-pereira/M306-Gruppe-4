import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/zaehlerstaende/route";

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

    const req = new Request("http://localhost:3000/api/zaehlerstaende", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.totalValues).toBe(3);
    expect(body.sensors).toEqual(["ID742", "ID735"]);
  });

  it("rejects non-array payloads with 400 Bad Request", async () => {
    const req = new Request("http://localhost:3000/api/zaehlerstaende", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "invalid" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Array");
  });

  it("serves plain JSON on GET request", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    const json = await res.json();
    expect(json.status).toBe("received");
    expect(json.totalValues).toBe(3);
    expect(json.data).toHaveLength(2);
  });
});
