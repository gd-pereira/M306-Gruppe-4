import { NextResponse } from "next/server";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";

// a json export of both sensors over the whole period is about 9 MB
const MAX_BYTES = 16 * 1024 * 1024;

function sessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return value.join("=");
  }
  return undefined;
}

// only a logged-in browser may send or read data, everyone else gets 401
async function unauthorized(request: Request): Promise<Response | null> {
  if (await isValidSession(sessionCookie(request))) return null;
  return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}

const tooLarge = () =>
  NextResponse.json(
    { error: "Body zu gross: höchstens 16 MB" },
    { status: 413 },
  );

// reads the body but stops as soon as it gets larger than MAX_BYTES
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES)
    return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

interface Reading {
  ts: string;
  value: number;
}

interface SensorData {
  sensorId: string;
  data: Reading[];
}

interface StoredBatch {
  status: "received";
  receivedAt: string;
  totalValues: number;
  sensors: string[];
  data: SensorData[];
}

// In-memory store for the demo server
let latestBatch: StoredBatch | null = null;
let totalReceivedBatches = 0;

export async function POST(request: Request) {
  const denied = await unauthorized(request);
  if (denied) return denied;
  const text = await readBody(request);
  if (text === null) return tooLarge();
  try {
    const body: unknown = JSON.parse(text);

    if (!Array.isArray(body)) {
      return NextResponse.json(
        {
          error:
            "Ungültiges Format: Der Body muss ein JSON-Array von Sensoren sein.",
          detail: "Erwartet wird [{ sensorId: string, data: [{ ts, value }] }]",
        },
        { status: 400 },
      );
    }

    const sensors: string[] = [];
    const sensorList: SensorData[] = [];
    let totalValues = 0;

    for (const item of body) {
      if (!item || typeof item !== "object" || !("sensorId" in item)) {
        continue;
      }
      const sensorItem = item as SensorData;
      const data = Array.isArray(sensorItem.data) ? sensorItem.data : [];
      totalValues += data.length;
      sensors.push(String(sensorItem.sensorId));
      sensorList.push({
        sensorId: String(sensorItem.sensorId),
        data,
      });
    }

    const receivedAt = new Date().toLocaleString("de-CH", {
      timeZone: "Europe/Zurich",
      dateStyle: "medium",
      timeStyle: "medium",
    });

    latestBatch = {
      status: "received",
      receivedAt,
      totalValues,
      sensors,
      data: sensorList,
    };
    totalReceivedBatches++;

    const sensorNames = sensors.join(", ") || "keine";

    return NextResponse.json(
      {
        ok: true,
        message: `${totalValues.toLocaleString("de-CH")} Zählerstand-Werte für ${sensorNames} erfolgreich empfangen`,
        receivedAt,
        totalValues,
        sensors,
        inspectUrl: "/api/zaehlerstaende",
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Fehler beim Parsen des JSON-Body",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
      },
      { status: 400 },
    );
  }
}

export async function GET(request: Request) {
  const denied = await unauthorized(request);
  if (denied) return denied;
  if (!latestBatch) {
    return new Response(
      JSON.stringify(
        {
          status: "waiting",
          message:
            "Bereit für POST /api/zaehlerstaende. Noch keine Daten empfangen.",
          batchesReceived: totalReceivedBatches,
          data: null,
        },
        null,
        2,
      ),
      {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  return new Response(
    JSON.stringify(
      {
        status: "received",
        receivedAt: latestBatch.receivedAt,
        totalValues: latestBatch.totalValues,
        sensors: latestBatch.sensors,
        data: latestBatch.data,
      },
      null,
      2,
    ),
    {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}
