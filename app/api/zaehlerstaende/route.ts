import { NextResponse } from "next/server";

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
  try {
    const body: unknown = await request.json();

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

export async function GET() {
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
