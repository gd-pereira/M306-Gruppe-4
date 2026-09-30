import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseServerUrl,
  requestHead,
  requestTarget,
  responseMessage,
  sendExport,
  statusText,
} from "@/components/export/api-request";
import { modeFromParams, selectionParams } from "@/components/export/selection";

const range = { from: "2020-02-08", to: "2020-02-10" };
const url = parseServerUrl("https://example.ch/api/zaehlerstaende")!;

describe("server url", () => {
  it("accepts complete http and https urls", () => {
    expect(parseServerUrl(" https://example.ch/api/zaehlerstaende ")).toEqual({
      href: "https://example.ch/api/zaehlerstaende",
      host: "example.ch",
      path: "/api/zaehlerstaende",
    });
    expect(parseServerUrl("http://localhost:3000/import?key=1")?.path).toBe(
      "/import?key=1",
    );
  });

  it("rejects urls without http:// or https://", () => {
    expect(parseServerUrl("example.ch/api")).toBeNull();
    expect(parseServerUrl("ftp://example.ch")).toBeNull();
    expect(parseServerUrl("https://")).toBeNull();
    expect(parseServerUrl("")).toBeNull();
  });

  it("shows a target in the preview while the url is incomplete", () => {
    expect(requestTarget("example.ch/api")).toEqual({
      host: "example.ch",
      path: "/api",
    });
    expect(requestTarget("htps://example.ch")).toEqual({
      host: "example.ch",
      path: "/",
    });
    expect(requestTarget("")).toEqual({
      host: "example.ch",
      path: "/api/zaehlerstaende",
    });
    expect(requestHead({ host: "example.ch", path: "/api" })).toEqual([
      "POST /api HTTP/1.1",
      "Host: example.ch",
      "Content-Type: application/json",
      "",
    ]);
  });
});

describe("server answer", () => {
  it("fills in the status text http/2 leaves out", () => {
    expect(statusText(500, "")).toBe("Internal Server Error");
    expect(statusText(500, "Kaputt")).toBe("Kaputt");
    expect(statusText(599, "")).toBe("");
  });

  it("reads a short reason from the body", () => {
    expect(responseMessage('{"error":"Database unavailable"}')).toBe(
      "Database unavailable",
    );
    expect(responseMessage("Database unavailable\nstack trace")).toBe(
      "Database unavailable",
    );
    expect(responseMessage("<!doctype html><h1>500</h1>")).toBeNull();
    expect(responseMessage('{"code":17}')).toBeNull();
    expect(responseMessage("")).toBeNull();
    expect(responseMessage("x".repeat(200))).toHaveLength(120);
  });
});

describe("sending", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the json export and reports the time", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await sendExport(url, range, new AbortController().signal);
    expect(result).toMatchObject({
      kind: "sent",
      status: 201,
      statusText: "Created",
    });
    const [target, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(url.href);
    expect(init.method).toBe("POST");
    const body = JSON.parse(await (init.body as Blob).text());
    expect(body.map((entry: { sensorId: string }) => entry.sensorId)).toEqual([
      "ID742",
      "ID735",
    ]);
  });

  it("reports http errors with the reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"error":"Database unavailable"}', { status: 500 }),
      ),
    );
    expect(await sendExport(url, range, new AbortController().signal)).toEqual({
      kind: "http",
      status: 500,
      statusText: "Internal Server Error",
      message: "Database unavailable",
    });
  });

  it("treats network and cors errors as unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await sendExport(url, range, new AbortController().signal)).toEqual({
      kind: "unreachable",
    });
  });

  it("does not report anything when the request is cancelled", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      }),
    );
    await expect(sendExport(url, range, controller.signal)).rejects.toThrow(
      "aborted",
    );
  });
});

describe("mode in the url", () => {
  it("keeps the api mode next to the other settings", () => {
    expect(modeFromParams({ modus: "api" })).toBe("api");
    expect(modeFromParams({ modus: "quatsch" })).toBe("file");
    const selection = {
      format: "csv" as const,
      sensor: "ID742" as const,
      range,
    };
    expect(selectionParams(selection, "api").get("modus")).toBe("api");
    expect(selectionParams(selection).has("modus")).toBe(false);
  });
});
