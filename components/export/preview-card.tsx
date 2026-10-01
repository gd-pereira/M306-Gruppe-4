"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/components/ui/toaster";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requestHead, type RequestTarget } from "./api-request";
import { useExportSource } from "./export-source";
import { preview, type ExportSelection, type ExportStats } from "./fake-export";
import { useElementSize } from "./hooks";

// 16.5px line height plus the 4px gap between rows, 12px padding top and bottom
const ROW = 20.5;
const PADDING = 24;

export function PreviewCard({
  selection,
  stats,
  valid,
  waiting,
  request,
}: {
  selection: ExportSelection;
  stats: ExportStats;
  valid: boolean;
  // the real import is still running, the preview has the demo values and may not be copied
  waiting: boolean;
  // api mode: the http request head comes before the json
  request?: RequestTarget;
}) {
  const [boxRef, { height }] = useElementSize<HTMLDivElement>();
  // one row stays free for "… N weitere Zeilen"
  const rows = Math.max(0, Math.floor((height - PADDING + 4) / ROW) - 1);
  const host = request?.host;
  const path = request?.path;
  const source = useExportSource();
  const content = useMemo(() => {
    const head =
      host !== undefined && path !== undefined
        ? requestHead({ host, path })
        : [];
    if (!valid || rows <= head.length) return null;
    const body = preview(selection, stats, rows - head.length, source);
    return { ...body, lines: [...head, ...body.lines], head: head.length };
  }, [valid, rows, selection, stats, host, path, source]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!content || waiting) return;
    try {
      await navigator.clipboard.writeText(content.lines.join("\n"));
      setCopied(true);
      toast({
        icon: <Copy />,
        title: "In die Zwischenablage kopiert",
        description: request
          ? `Die ersten ${content.lines.length} Zeilen der Anfrage an ${request.host}.`
          : `Die ersten ${content.lines.length} Zeilen der Vorschau (${stats.fileName}).`,
      });
    } catch {
      toast({
        icon: <Copy />,
        title: "Kopieren nicht möglich",
        description:
          "Der Browser erlaubt keinen Zugriff auf die Zwischenablage.",
      });
    }
  }

  // typing the url updates the request head in place, everything else crossfades
  const contentKey = valid
    ? `${request ? "api" : stats.fileName}-${selection.range.from}-${selection.range.to}`
    : "empty";

  return (
    <section
      aria-labelledby="export-preview-title"
      className="flex min-h-[420px] w-full flex-col gap-3 rounded-card bg-card px-6 py-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <h2 id="export-preview-title" className="text-[15px] font-semibold">
          Vorschau
        </h2>
        <button
          type="button"
          onClick={copy}
          disabled={!content || waiting}
          className={cn(
            "-mr-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors duration-150 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:text-border-strong disabled:hover:bg-transparent",
            copied ? "text-success-strong" : "text-soft-foreground",
          )}
        >
          <span className="relative flex size-3.5 items-center justify-center">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={copied ? "done" : "copy"}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15 }}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
          {copied ? "Kopiert" : "Kopieren"}
        </button>
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={request ? "api" : stats.fileName}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2 }}
          className="truncate font-mono text-xs text-muted-foreground"
        >
          {request
            ? `Anfrage an ${request.host} · application/json`
            : stats.fileName}
        </motion.p>
      </AnimatePresence>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-muted bg-surface">
        <div
          ref={boxRef}
          className="absolute inset-0 px-3.5 py-3 font-mono text-xs"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {content ? (
                <div className="flex flex-col gap-1 leading-[16.5px] whitespace-pre">
                  {content.lines.map((line, index) => (
                    <div key={index} className="flex gap-3.5">
                      <span className="text-border-strong select-none">
                        {String(index + 1).padStart(2)}
                      </span>
                      <span
                        className={cn(
                          index < content.head ||
                            (selection.format === "csv" && index === 0) ||
                            line.trim() === "…"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {line}
                      </span>
                    </div>
                  ))}
                  {content.remaining > 0 && (
                    <p className="text-faint">
                      … {formatNumber(content.remaining)} weitere {content.unit}
                    </p>
                  )}
                </div>
              ) : (
                !valid && (
                  <div className="flex h-full flex-col items-center justify-center gap-1 font-sans">
                    <p className="text-[13px] font-medium text-muted-foreground">
                      Keine Vorschau
                    </p>
                    <p className="text-xs text-faint">
                      Zuerst einen gültigen Zeitraum wählen.
                    </p>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
