import { SENSOR_IDS } from "@/lib/types";
import { buildFile, type DayRange, type ExportSource } from "./export-data";

// stand-in for the POST from T4-6, sends the same body as the json export

export interface RequestTarget {
  host: string;
  path: string;
}

export interface ServerUrl extends RequestTarget {
  href: string;
}

export const PLACEHOLDER_URL = "https://example.ch/api/zaehlerstaende";
const PLACEHOLDER_TARGET: RequestTarget = {
  host: "example.ch",
  path: "/api/zaehlerstaende",
};

// only complete http(s) urls count, "example.ch/api" is not enough
export function parseServerUrl(input: string): ServerUrl | null {
  const value = input.trim();
  if (!/^https?:\/\/[^/]/i.test(value)) return null;
  try {
    const url = new URL(value);
    return {
      href: url.href,
      host: url.host,
      path: `${url.pathname}${url.search}`,
    };
  } catch {
    return null;
  }
}

// host and path for the preview, also while the url is still incomplete
export function requestTarget(input: string): RequestTarget {
  const value = input.trim();
  if (!value) return PLACEHOLDER_TARGET;
  const url =
    parseServerUrl(value) ??
    parseServerUrl(`https://${value.replace(/^([a-z]+:)?\/+/i, "")}`);
  return url ? { host: url.host, path: url.path } : PLACEHOLDER_TARGET;
}

export function requestHead(target: RequestTarget): string[] {
  return [
    `POST ${target.path} HTTP/1.1`,
    `Host: ${target.host}`,
    "Content-Type: application/json",
    "",
  ];
}

export type SendResult =
  | { kind: "sent"; status: number; statusText: string; at: Date }
  | { kind: "unreachable" }
  | {
      kind: "http";
      status: number;
      statusText: string;
      message: string | null;
    };

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  413: "Payload Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

// http/2 responses come without a status text
export function statusText(status: number, text: string): string {
  return text || STATUS_TEXT[status] || "";
}

const MESSAGE_LENGTH = 120;

// short reason from the response body: a json error field or the first line of plain text, no html pages
export function responseMessage(body: string): string | null {
  const text = body.trim();
  if (!text || text.startsWith("<")) return null;
  let message = text.split("\n")[0].trim();
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") message = parsed;
    else if (parsed && typeof parsed === "object") {
      const field = ["error", "message", "detail"]
        .map((key) => (parsed as Record<string, unknown>)[key])
        .find((value) => typeof value === "string");
      if (typeof field !== "string") return null;
      message = field;
    }
  } catch {
    // plain text
  }
  return message.length > MESSAGE_LENGTH
    ? `${message.slice(0, MESSAGE_LENGTH - 1)}…`
    : message;
}

const TIMEOUT = 30_000;

export async function sendExport(
  url: ServerUrl,
  range: DayRange,
  signal: AbortSignal,
  // the imported readings, see export-source.ts
  source: ExportSource,
): Promise<SendResult> {
  const body = await buildFile(
    { format: "json", sensor: SENSOR_IDS.consumption, range },
    source,
  );
  let response: Response;
  try {
    response = await fetch(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT)]),
    });
  } catch (error) {
    // leaving the page cancels the request, that is not an error to show
    if (signal.aborted) throw error;
    // network error, blocked by cors or no answer in time
    return { kind: "unreachable" };
  }
  const text = statusText(response.status, response.statusText);
  if (response.ok)
    return {
      kind: "sent",
      status: response.status,
      statusText: text,
      at: new Date(),
    };
  const message = responseMessage(await response.text().catch(() => ""));
  return { kind: "http", status: response.status, statusText: text, message };
}
