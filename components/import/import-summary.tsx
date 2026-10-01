"use client";

import NumberFlow from "@number-flow/react";
import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { dayOf, dayStart } from "@/components/export/export-data";
import { EASE_OUT } from "@/components/motion-provider";
import { formatDate, formatNumber } from "@/lib/format";
import { SENSOR_IDS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ImportSummary as Summary } from "./import-view";

// 01.01. 00:00 swiss time, the data starts there and not at 01:00
function yearStart(year: number): number {
  return dayStart(`${year}-01-01`);
}

function yearOf(ts: number): number {
  return Number(dayOf(ts).slice(0, 4));
}

// sdat as one bar with its gaps in red, every esl reading as a thin tick, years below
function Coverage({ summary }: { summary: Summary }) {
  const { period, sdat, eslReadings } = summary;
  if (!period) return null;

  const start = yearStart(yearOf(period.start));
  const end = Math.max(period.end, sdat?.end ?? 0) + 30 * 24 * 60 * 60;
  const x = (ts: number) => ((ts - start) / (end - start)) * 100;

  const years: number[] = [];
  for (let year = yearOf(period.start); yearStart(year) <= end; year++) {
    years.push(year);
  }

  return (
    <div
      className="grid grid-cols-[34px_1fr] items-center gap-y-2.5 text-[11px] text-muted-foreground"
      role="img"
      aria-label={`Abdeckung: SDAT ${sdat ? `${formatDate(sdat.start)} bis ${formatDate(sdat.end)}, ${sdat.gaps.length} Lücken` : "keine"}, ${eslReadings.length} ESL-Ablesungen`}
    >
      <span>SDAT</span>
      <div className="relative h-2 rounded-[2px] bg-muted">
        {sdat && (
          <motion.div
            className="absolute inset-y-0 origin-left rounded-[2px] bg-primary"
            style={{
              left: `${x(sdat.start)}%`,
              width: `${x(sdat.end) - x(sdat.start)}%`,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 }}
          />
        )}
        {sdat?.gaps.map((gap, index) => (
          <motion.div
            key={gap.start}
            title={`Lücke ${formatDate(gap.start)} – ${formatDate(gap.end)}`}
            className="absolute inset-y-0 min-w-[2px] bg-danger"
            style={{
              left: `${x(gap.start)}%`,
              width: `${x(gap.end) - x(gap.start)}%`,
            }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.25, delay: 0.7 + index * 0.05 }}
          />
        ))}
      </div>

      <span>ESL</span>
      <div className="relative h-2 rounded-[2px] bg-muted">
        {eslReadings.map((ts, index) => (
          <motion.div
            key={ts}
            className="absolute inset-y-0 w-[1.5px] bg-primary"
            style={{ left: `${x(ts)}%` }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{
              duration: 0.2,
              delay: 0.3 + Math.min(index, 60) * 0.012,
            }}
          />
        ))}
      </div>

      <span />
      <div className="relative h-3 text-[10px] text-faint">
        {years.map((year) => (
          <span
            key={year}
            className="absolute top-0 tabular-nums"
            style={{ left: `${x(yearStart(year))}%` }}
          >
            {year}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  hint,
  swatch,
  children,
}: {
  label: string;
  hint: string;
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {swatch && (
          <span
            className={cn("size-2 shrink-0 rounded-[2px]", swatch)}
            aria-hidden
          />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="text-[13px] text-foreground">{label}</span>
          <span className="truncate text-[11px] text-faint">{hint}</span>
        </div>
      </div>
      <span className="shrink-0 text-[13px] font-medium tabular-nums">
        {children}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-muted" />;
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-[0.04em] text-faint uppercase">
      {children}
    </p>
  );
}

function Count({ value, suffix }: { value: number; suffix?: string }) {
  return <NumberFlow value={value} suffix={suffix} locales="de-CH" />;
}

function plural(count: number, one: string, many: string): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

export function ImportSummary({
  summary,
  errorCount,
  ignoredCount,
  onShowErrors,
  onShowIgnored,
}: {
  summary: Summary;
  errorCount: number;
  ignoredCount: number;
  onShowErrors: () => void;
  onShowIgnored: () => void;
}) {
  const gaps = summary.sdat?.gaps.length ?? 0;

  return (
    <section
      aria-labelledby="summary-title"
      className="flex shrink-0 flex-col gap-3 rounded-card bg-card px-5 py-[18px] shadow-card xl:w-[340px]"
    >
      <h2 id="summary-title" className="text-[15px] font-semibold">
        Zusammenfassung
      </h2>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">Zeitraum</span>
          <span className="text-[15px] font-medium tabular-nums">
            {summary.period
              ? `${formatDate(summary.period.start)} – ${formatDate(summary.period.end)}`
              : "–"}
          </span>
        </div>
        <Coverage summary={summary} />
      </div>

      <Divider />
      <GroupLabel>Eingelesen</GroupLabel>
      <Stat label="Bezug" hint={SENSOR_IDS.consumption} swatch="bg-primary">
        <Count value={summary.values.consumption} suffix=" Werte" />
      </Stat>
      <Stat label="Einspeisung" hint={SENSOR_IDS.feedIn} swatch="bg-brand">
        <Count value={summary.values.feedIn} suffix=" Werte" />
      </Stat>
      <Stat
        label="ESL-Ablesungen"
        hint={`aus ${plural(summary.eslFiles, "Datei", "Dateien")}`}
      >
        <Count value={summary.eslReadings.length} />
      </Stat>

      <Divider />
      <GroupLabel>Bereinigt</GroupLabel>
      <Stat label="Doppelte Werte" hint="identisch, nur einmal übernommen">
        <Count value={summary.duplicates} />
      </Stat>
      <Stat
        label="Nachgelieferte Werte"
        hint="Nullwerte durch spätere Dateien ersetzt"
      >
        <Count value={summary.replaced} />
      </Stat>
      <Stat
        label="Lücken im SDAT"
        hint={
          gaps === 0
            ? "keine Zeiträume ohne Werte"
            : `${plural(gaps, "Zeitraum", "Zeiträume")} ohne Werte`
        }
        swatch={gaps > 0 ? "bg-danger" : undefined}
      >
        <Count
          value={summary.gapDays}
          suffix={summary.gapDays === 1 ? " Tag" : " Tage"}
        />
      </Stat>

      <Divider />
      {errorCount > 0 && (
        <SummaryButton
          label="Fehlerhafte Dateien"
          hint="nicht lesbar, siehe Tabelle"
          value={errorCount}
          danger
          onClick={onShowErrors}
        />
      )}
      <SummaryButton
        label="Ignorierte Dateien"
        hint={
          summary.ignoredSensors.length > 0
            ? `andere Sensoren: ${summary.ignoredSensors.join(", ")}`
            : "keine fremden Sensoren gefunden"
        }
        value={ignoredCount}
        disabled={ignoredCount === 0}
        onClick={onShowIgnored}
      />
    </section>
  );
}

function SummaryButton({
  label,
  hint,
  value,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  value: number;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group/row -mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-left transition-colors duration-150 hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none"
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] text-foreground">{label}</span>
        <span className="truncate text-[11px] text-faint">{hint}</span>
      </span>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-[13px] font-medium tabular-nums",
          danger && "text-danger-strong",
        )}
      >
        <Count value={value} />
        {!disabled && (
          <ChevronRight
            className="size-3.5 text-faint transition-transform duration-200 group-hover/row:translate-x-0.5"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}
