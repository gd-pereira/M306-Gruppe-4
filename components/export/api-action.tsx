"use client";

import { CircleAlert, CircleCheck, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { EASE_OUT } from "@/components/motion-provider";
import { formatNumber } from "@/lib/format";
import type { SendResult } from "./api-request";
import {
  formatBytes,
  type ExportSelection,
  type ExportStats,
} from "./fake-export";
import { AnimatedNumber } from "./hooks";
import {
  ActionBar,
  ActionButton,
  periodOf,
  WAITING_DETAIL,
  WAITING_TITLE,
} from "./summary-card";

export type ApiState =
  | { kind: "idle" }
  | { kind: "sending"; host: string }
  | {
      kind: "done";
      result: SendResult;
      host: string;
      values: number;
      sensors: number;
    };

export function ApiAction({
  selection,
  stats,
  valid,
  waiting,
  url,
  host,
  state,
  onSend,
}: {
  selection: ExportSelection;
  stats: ExportStats;
  valid: boolean;
  // the real import is still running, sending now would send the demo values
  waiting: boolean;
  // "empty" while nothing is typed, "invalid" for an incomplete url
  url: "empty" | "invalid" | "ok";
  host: string;
  state: ApiState;
  onSend: () => void;
}) {
  const sending = state.kind === "sending";
  const failed = state.kind === "done" && state.result.kind !== "sent";
  const ready = valid && url === "ok" && !waiting;

  const bar = waiting
    ? { key: "waiting", title: WAITING_TITLE }
    : !valid
      ? { key: "range", title: "Nichts zu senden" }
      : sending
        ? { key: "sending", title: `Wird an ${state.host} gesendet …` }
        : url === "empty"
          ? { key: "empty", title: "Server-URL eingeben" }
          : url === "invalid"
            ? { key: "invalid", title: "Keine gültige URL" }
            : { key: "ready", title: `An ${host} senden` };

  return (
    <div className="flex flex-col">
      <ActionBar
        swapKey={bar.key}
        title={bar.title}
        size={ready || sending ? formatBytes(stats.bytes) : undefined}
        idle={!ready && !sending}
        danger={!valid && !waiting}
        detail={
          waiting ? (
            WAITING_DETAIL
          ) : valid ? (
            <>
              <AnimatedNumber value={stats.values} /> Werte ·{" "}
              {stats.sensors.length} Sensoren · JSON · {periodOf(selection)}
            </>
          ) : (
            "Kein gültiger Zeitraum ausgewählt"
          )
        }
      >
        <ActionButton
          icon={Send}
          busy={sending}
          disabled={!ready}
          onClick={onSend}
        >
          {sending ? "Sendet …" : failed ? "Erneut senden" : "Senden"}
        </ActionButton>
      </ActionBar>

      <AnimatePresence initial={false}>
        {state.kind === "done" && (
          <motion.div
            key={`${state.result.kind}-${resultTime(state.result)}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <SendStatus state={state} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function resultTime(result: SendResult): number {
  return result.kind === "sent" ? result.at.getTime() : 0;
}

function SendStatus({ state }: { state: Extract<ApiState, { kind: "done" }> }) {
  const { result, host } = state;

  if (result.kind === "sent") {
    const time = result.at.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div
        role="status"
        className="flex flex-col gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success-strong sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2">
          <CircleCheck className="size-3.5 shrink-0" aria-hidden />
          <span>
            {`${result.status} ${result.statusText}`.trim()} · {state.sensors}{" "}
            Sensoren ({formatNumber(state.values)} Werte) gesendet um {time}
          </span>
        </div>
        {host.includes("localhost") || host.includes("127.0.0.1") ? (
          <a
            href="/api/zaehlerstaende"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground underline underline-offset-2 hover:opacity-80"
          >
            Empfangene Daten ansehen ↗
          </a>
        ) : null}
      </div>
    );
  }

  const title =
    result.kind === "unreachable"
      ? "Server nicht erreichbar"
      : `${result.status} ${result.statusText}`.trim();
  const text =
    result.kind === "unreachable"
      ? `Keine Antwort von ${host}. Prüfe die URL oder ob der Server Anfragen von dieser Seite erlaubt (CORS).`
      : [
          "Der Server hat die Daten nicht angenommen.",
          result.message && `Antwort: „${result.message}“.`,
          result.status < 500
            ? "URL und Format prüfen."
            : "Später erneut senden.",
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-danger-border-soft bg-danger-soft px-3 py-2.5"
    >
      <CircleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] font-medium text-danger-deep">{title}</p>
        <p className="text-xs text-danger-strong">{text}</p>
      </div>
    </div>
  );
}
