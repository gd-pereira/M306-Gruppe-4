"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { useElementSize } from "@/components/export/hooks";
import {
  addDays,
  dayKey,
  daysBetween,
  formatDay,
  formatDayRange,
  type DayKey,
  type DayRange,
} from "@/components/export/fake-export";
import { formatNumber } from "@/lib/format";
import type { SensorId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { shortRange } from "./chart-axes";
import {
  eslReadings,
  FIRST_ESL,
  gapDays,
  gapsIn,
  rangeEnd,
  rangeStart,
  SDAT_END,
  SDAT_FACTOR,
  sourceSegments,
  type SourceKind,
} from "./fake-analysis";
import { intersect, type Period } from "./period";
import { rise } from "./parts";

const SEGMENT: Record<
  SourceKind,
  { bar: string; text: string; label: string }
> = {
  backcalc: {
    bar: "bg-[#ffe7a8]",
    text: "text-brand-strong",
    label: "Zurückgerechnet",
  },
  measured: {
    bar: "bg-primary",
    text: "text-primary-foreground",
    label: "Gemessen · SDAT an ESL angepasst",
  },
  eslOnly: {
    bar: "bg-border",
    text: "text-soft-foreground",
    label: "Nur ESL",
  },
  none: {
    bar: "border border-dashed border-border-strong bg-surface",
    text: "text-[10px] font-normal text-faint",
    label: "keine Daten",
  },
};

const MIN_LABEL_GAP = 84;

function monthOf(day: DayKey): DayRange {
  const [y, m] = day.split("-").map(Number);
  return { from: dayKey(y, m - 1, 1), to: dayKey(y, m, 0) };
}

interface Item {
  swatch: string;
  title: string;
  text: string;
}

// timeline of the sources in the shown period and one line of explanation per source
export function SourcesCard({
  sensor,
  period,
}: {
  sensor: SensorId;
  period: Period;
}) {
  const { range } = period;
  const [barRef, { width }] = useElementSize<HTMLDivElement>();
  const segments = useMemo(() => sourceSegments(range), [range]);
  const gaps = useMemo(() => gapsIn(range), [range]);
  const esl = eslReadings(sensor);
  const long = daysBetween(range.from, range.to) > 400;
  const t0 = rangeStart(range);
  const t1 = rangeEnd(range);
  const fraction = (from: DayKey, to: DayKey) => ({
    left: (rangeStart({ from, to }) - t0) / (t1 - t0),
    width: (rangeEnd({ from, to }) - rangeStart({ from, to })) / (t1 - t0),
  });

  // over several years whole months are marked, they would be too thin as days
  const marks = long
    ? [...new Set(gaps.map((gap) => gap.from.slice(0, 7)))].flatMap((month) => {
        const inside = intersect(monthOf(`${month}-01`), range);
        return inside ? [inside] : [];
      })
    : gaps;

  const boundaries = [
    ...segments.map((segment) => segment.range.from),
    addDays(range.to, 1),
  ];
  const eslOn = (day: DayKey) => esl.find((reading) => reading.day === day);
  const labels: { day: DayKey; x: number; text: string }[] = [];
  boundaries.forEach((day, index) => {
    const x = ((rangeStart({ from: day, to: day }) - t0) / (t1 - t0)) * width;
    const last = index === boundaries.length - 1;
    const previous = labels[labels.length - 1];
    if (previous && x - previous.x < MIN_LABEL_GAP) {
      if (!last) return;
      labels.pop();
    }
    const reading = long ? undefined : eslOn(day);
    const date = long
      ? index === 0
        ? day.slice(0, 4)
        : `${day.slice(5, 7)}.${day.slice(0, 4)}`
      : formatDay(day);
    labels.push({
      day,
      x,
      text: reading ? `${date} · ESL ${formatNumber(reading.value, 1)}` : date,
    });
  });

  const has = (kind: SourceKind) =>
    segments.find((segment) => segment.kind === kind);
  const items: Item[] = [];
  if (has("backcalc")) {
    items.push({
      swatch: "border border-border-strong bg-[#ffe7a8]",
      title: "Zurückgerechnet · 2018",
      text: `Ab der ersten ESL-Ablesung ${formatNumber(esl[0].value, 1)} kWh (${formatDay(FIRST_ESL)}) rückwärts mit SDAT ÷ ${SDAT_FACTOR.toFixed(2)}`,
    });
  }
  const measured = has("measured");
  if (measured) {
    items.push({
      swatch: "bg-primary",
      title: `Gemessen · ${formatDayRange(measured.range)}`,
      text: "SDAT-Verlauf, trifft jede monatliche ESL-Ablesung genau",
    });
  }
  if (gaps.length > 0) {
    const days = gapDays(gaps);
    items.push(
      long
        ? {
            swatch: "bg-danger",
            title: `Monat mit Lücke · ${marks.length}×`,
            text: `${marks.map((m) => `${m.from.slice(5, 7)}/${m.from.slice(0, 4)}`).join(", ")}: SDAT-Werte fehlen, der ESL-Wert stimmt trotzdem`,
          }
        : {
            swatch: "bg-danger",
            title: `Fehlende SDAT-Tage · ${days} ${days === 1 ? "Tag" : "Tage"}`,
            text: `${gaps.map(shortRange).join(" und ")}: dort läuft die Linie gerade, der nächste ESL-Wert stimmt trotzdem`,
          },
    );
  } else if (measured) {
    items.push({
      swatch: "bg-success",
      title: "Vollständig",
      text: "In diesem Zeitraum fehlen keine SDAT-Werte",
    });
  }
  if (has("eslOnly")) {
    const last =
      esl.findLast((reading) => reading.ts <= t1) ?? esl[esl.length - 1];
    items.push({
      swatch: "border border-border-strong bg-border",
      title: `Nur ESL · ab ${formatDay(SDAT_END)}`,
      text: `Keine SDAT-Daten mehr, die gestrichelte Linie verbindet die Ablesungen bis ${formatNumber(last.value, 1)} kWh`,
    });
  }

  const drawKey = `${range.from}_${range.to}`;

  return (
    <motion.section
      variants={rise}
      aria-label="Woher die Werte kommen"
      className="flex flex-col gap-3.5 rounded-card bg-card px-5 py-4 shadow-card"
    >
      <h2 className="text-[15px] font-semibold">Woher die Werte kommen</h2>

      <div className="grid grid-cols-[52px_1fr] gap-y-1.5">
        <span className="self-center text-[11px] font-medium text-faint">
          Quelle
        </span>
        <div
          ref={barRef}
          className="relative h-[26px] overflow-hidden rounded-md"
        >
          <motion.div
            key={drawKey}
            className="absolute inset-0 origin-left"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            {segments.map((segment) => {
              const style = SEGMENT[segment.kind];
              const { left, width: share } = fraction(
                segment.range.from,
                segment.range.to,
              );
              return (
                <div
                  key={segment.kind}
                  className={cn("absolute inset-y-0", style.bar)}
                  style={{ left: `${left * 100}%`, width: `${share * 100}%` }}
                />
              );
            })}
            {marks.map((mark) => {
              const { left, width: share } = fraction(mark.from, mark.to);
              return (
                <div
                  key={mark.from}
                  className="absolute inset-y-0 min-w-[3px] bg-danger"
                  style={{ left: `${left * 100}%`, width: `${share * 100}%` }}
                />
              );
            })}
          </motion.div>
          <motion.div
            key={`labels-${drawKey}`}
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.35 }}
          >
            {width > 0 &&
              segments.map((segment) => {
                const style = SEGMENT[segment.kind];
                const { left, width: share } = fraction(
                  segment.range.from,
                  segment.range.to,
                );
                if (share * width < style.label.length * 6 + 16) return null;
                return (
                  <span
                    key={segment.kind}
                    className={cn(
                      "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] font-medium whitespace-nowrap",
                      style.text,
                    )}
                    style={{ left: `${(left + share / 2) * 100}%` }}
                  >
                    {style.label}
                  </span>
                );
              })}
          </motion.div>
        </div>
        <span />
        <div className="relative h-3.5 text-[10px] text-muted-foreground">
          {width > 0 &&
            labels.map((label, index) => (
              <span
                key={label.day}
                className={cn(
                  "absolute top-0 whitespace-nowrap tabular-nums",
                  index === 0
                    ? ""
                    : index === labels.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{ left: label.x }}
              >
                {label.text}
              </span>
            ))}
        </div>
      </div>

      <div className="flex gap-5 pl-[52px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.title}
              layout="position"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="flex min-w-0 flex-1 gap-2"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 size-2.5 shrink-0 rounded-[2px]",
                  item.swatch,
                )}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-medium">{item.title}</span>
                <span className="text-[11px] leading-[15px] text-muted-foreground">
                  {item.text}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
