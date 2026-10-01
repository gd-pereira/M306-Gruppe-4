"use client";

import {
  ArrowRight,
  Download,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  formatBytes,
  formatDay,
  formatDayRange,
  type ExportSelection,
  type ExportStats,
} from "./fake-export";
import { AnimatedNumber } from "./hooks";
import { MeterChart } from "./meter-chart";
import { meterHref } from "./selection";

const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export function periodOf(selection: ExportSelection): string {
  return `${formatDay(selection.range.from)} – ${formatDay(selection.range.to)}`;
}

// head, chart and gaps are the same for file and api, the bar below comes from the mode
export function SummaryCard({
  selection,
  stats,
  valid,
  children,
}: {
  selection: ExportSelection;
  stats: ExportStats;
  valid: boolean;
  children: ReactNode;
}) {
  const { range } = selection;
  const gapsKey = `${range.from}-${range.to}`;

  return (
    <section
      aria-labelledby="export-summary-title"
      className="flex min-h-0 flex-1 flex-col gap-4 rounded-card bg-card p-6 shadow-card"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <h2 id="export-summary-title" className="text-[15px] font-semibold">
            Zusammenfassung
          </h2>
          <span className="text-xs text-faint">Zählerstand in kWh</span>
        </div>
        {valid ? (
          <Link
            href={meterHref(selection)}
            className="group/link flex items-center gap-1 rounded-md py-0.5 pr-1 pl-1.5 text-xs font-medium text-primary transition-colors duration-150 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Im Zählerstand ansehen
            <ArrowRight
              className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : (
          <span
            aria-disabled
            className="flex items-center gap-1 py-0.5 pr-1 pl-1.5 text-xs font-medium text-faint"
          >
            Im Zählerstand ansehen
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <MeterChart selection={selection} dimmed={!valid} />
        <AnimatePresence>
          {!valid && (
            <motion.span
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground"
            >
              Kein gültiger Zeitraum ausgewählt
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 transition-opacity duration-300",
          !valid && "opacity-40",
        )}
      >
        <span className="h-2.5 w-[3px] bg-danger" aria-hidden />
        <span className="mr-0.5 text-[11px] text-muted-foreground">
          {stats.gaps.length === 0
            ? "Keine Lücken im Zeitraum"
            : selection.format === "json"
              ? "Lücken ohne Werte, beide Sensoren:"
              : "Lücken ohne Werte:"}
        </span>
        <motion.ul
          key={gapsKey}
          className="contents"
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
        >
          {stats.gaps.map((gap) => (
            <motion.li
              key={gap.from}
              variants={{
                initial: { opacity: 0, y: 4 },
                animate: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.25 }}
              className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger-strong tabular-nums"
            >
              {formatDayRange(gap)}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      {children}
    </section>
  );
}

// grey bar at the bottom: what gets exported on the left, the action on the right
export function ActionBar({
  swapKey,
  title,
  size,
  detail,
  idle,
  danger,
  children,
}: {
  // a new key crossfades the text, the same key updates it in place
  swapKey: string;
  title: ReactNode;
  size?: string;
  detail: ReactNode;
  idle?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-5 overflow-hidden rounded-xl bg-surface py-4 pr-4 pl-5">
      <div className="relative min-w-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={swapKey}
            {...swap}
            className="flex flex-col gap-[3px]"
          >
            <p className="flex min-w-0 items-baseline gap-2">
              <span
                className={cn(
                  "truncate text-[15px] font-semibold",
                  idle && "text-faint",
                )}
              >
                {title}
              </span>
              {size && (
                <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">
                  {size}
                </span>
              )}
            </p>
            <p
              className={cn(
                "truncate text-xs tabular-nums",
                danger ? "text-danger-strong" : "text-muted-foreground",
              )}
            >
              {detail}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
      {children}
    </div>
  );
}

const pop = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6 },
  transition: { duration: 0.15 },
};

export function ActionButton({
  icon: Icon,
  busy,
  disabled,
  onClick,
  children,
}: {
  icon: LucideIcon;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      whileTap={{ scale: 0.98 }}
      className="flex shrink-0 items-center gap-2 rounded-[10px] bg-brand py-3 pr-[22px] pl-5 text-sm font-semibold whitespace-nowrap text-brand-foreground transition-[background-color,color,opacity] duration-150 outline-none hover:bg-brand/90 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-skeleton disabled:text-faint aria-busy:bg-brand aria-busy:text-brand-foreground aria-busy:opacity-70"
    >
      <span className="relative flex size-4 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {busy ? (
            <motion.span key="busy" {...pop}>
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            </motion.span>
          ) : (
            <motion.span key="idle" {...pop}>
              <Icon className="size-4" aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {children}
    </motion.button>
  );
}

// shown while the real import still runs, until then the screen only has the demo curve
export const WAITING_TITLE = "Daten werden noch eingelesen …";
export const WAITING_DETAIL =
  "Export ist möglich, sobald der Import fertig ist";

export function FileAction({
  selection,
  stats,
  valid,
  waiting,
  downloading,
  onDownload,
}: {
  selection: ExportSelection;
  stats: ExportStats;
  valid: boolean;
  // the real import is still running, a download now would have the demo values
  waiting: boolean;
  downloading: boolean;
  onDownload: () => void;
}) {
  const reading = stats.readings[selection.sensor];
  const period = periodOf(selection);
  return (
    <ActionBar
      swapKey={waiting ? "waiting" : valid ? "file" : "none"}
      title={waiting ? WAITING_TITLE : valid ? stats.fileName : "Keine Datei"}
      size={valid && !waiting ? formatBytes(stats.bytes) : undefined}
      idle={!valid || waiting}
      danger={!valid && !waiting}
      detail={
        waiting ? (
          WAITING_DETAIL
        ) : valid ? (
          <>
            <AnimatedNumber value={stats.values} /> Werte ·{" "}
            {selection.format === "json"
              ? `${stats.sensors.length} Sensoren · ${period}`
              : period}
            {selection.format === "csv" && reading && (
              <>
                {" · "}
                <AnimatedNumber value={reading.first} decimals={1} /> →{" "}
                <AnimatedNumber value={reading.last} decimals={1} /> kWh
              </>
            )}
          </>
        ) : (
          "Kein gültiger Zeitraum ausgewählt"
        )
      }
    >
      <ActionButton
        icon={Download}
        busy={downloading}
        disabled={!valid || waiting}
        onClick={onDownload}
      >
        Herunterladen
      </ActionButton>
    </ActionBar>
  );
}
