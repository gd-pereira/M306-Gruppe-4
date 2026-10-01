"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type PointerEvent } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { yTicks } from "@/components/export/export-data";
import { useElementSize } from "@/components/export/hooks";
import { formatNumber } from "@/lib/format";
import type { Direction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAnalysisData } from "./analysis-source";
import { monthComparison } from "./analysis-data";
import { LegendPill } from "./parts";
import { MONTH_NAMES, MONTH_SHORT } from "./period";
import { TooltipRow, TooltipTitle } from "./time-chart";

const COLOR: Record<Direction, string> = {
  consumption: "var(--primary)",
  feedIn: "var(--brand)",
};
const TOP_PAD = 10;
const BAR_MAX = 10;
const TOOLTIP_WIDTH = 176;

// older years lighter, the newest one in full colour
function yearColor(index: number, count: number, direction: Direction) {
  const share = count > 1 ? 30 + (70 * index) / (count - 1) : 100;
  return `color-mix(in oklab, ${COLOR[direction]} ${Math.round(share)}%, var(--card))`;
}

// the same month of every year next to each other, e.g. every january from 2018 to 2021
export function MonthComparison({ direction }: { direction: Direction }) {
  const data = useAnalysisData();
  const { years, months, max } = useMemo(
    () => monthComparison(direction, data),
    [direction, data],
  );
  const reduce = useReducedMotion();
  const [plotRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const ticks = yTicks(max, 4);
  const top = ticks[ticks.length - 1] ?? 1;
  const ready = width > 0 && height > 0;
  const y = (value: number) =>
    TOP_PAD + (1 - value / Math.max(1e-9, top)) * (height - TOP_PAD);
  const group = width / 12;
  const bar = Math.max(2, Math.min(BAR_MAX, (group * 0.7) / years.length));
  const gap = Math.min(2, bar / 4);
  const barX = (month: number, index: number) =>
    month * group +
    group / 2 -
    (years.length * (bar + gap) - gap) / 2 +
    index * (bar + gap);

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const month = Math.floor(((event.clientX - rect.left) / rect.width) * 12);
    setActive(Math.min(11, Math.max(0, month)));
  }

  const flip = active !== null && (active + 1) * group + TOOLTIP_WIDTH > width;
  const tooltipX =
    active === null
      ? 0
      : flip
        ? active * group - TOOLTIP_WIDTH - 8
        : (active + 1) * group + 8;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {years.map((year, index) => (
          <LegendPill
            key={year}
            bordered={false}
            swatch={
              <span
                aria-hidden
                className="size-2 rounded-[2px]"
                style={{
                  background: yearColor(index, years.length, direction),
                }}
              />
            }
            label={String(year)}
          />
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-faint">
          <span aria-hidden className="size-1.5 rounded-full bg-danger" />
          Monat mit SDAT-Lücke
        </span>
      </div>
      <div
        role="img"
        aria-label={`Monatsvergleich ${direction === "consumption" ? "Bezug" : "Einspeisung"} ${years[0]} bis ${years[years.length - 1]} in kWh`}
        className="grid h-[clamp(200px,28vh,260px)] grid-cols-[36px_1fr] grid-rows-[1fr_18px] gap-y-1.5"
      >
        <div className="relative" aria-hidden>
          {ready &&
            ticks.map((tick) => (
              <span
                key={tick}
                className="absolute right-2 -translate-y-1/2 text-[11px] text-faint tabular-nums"
                style={{ top: y(tick) }}
              >
                {formatNumber(tick)}
              </span>
            ))}
        </div>
        <div
          ref={plotRef}
          className="relative min-h-0"
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
        >
          {ready && (
            <svg
              className="absolute inset-0 overflow-visible"
              width={width}
              height={height}
              aria-hidden
            >
              {ticks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={width}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--muted)"
                />
              ))}
              {active !== null && (
                <rect
                  x={active * group + 2}
                  y={0}
                  width={group - 4}
                  height={height}
                  rx={6}
                  fill="var(--surface)"
                />
              )}
              <g key={direction}>
                {months.map((values, month) =>
                  values.map((entry, index) => {
                    if (!entry) return null;
                    const x = barX(month, index);
                    const barTop = y(entry.value);
                    return (
                      <g key={`${month}-${index}`}>
                        <motion.rect
                          x={x}
                          width={bar}
                          rx={Math.min(2, bar / 3)}
                          fill={yearColor(index, years.length, direction)}
                          initial={
                            reduce
                              ? { y: barTop, height: height - barTop }
                              : { y: height, height: 0 }
                          }
                          animate={{ y: barTop, height: height - barTop }}
                          transition={{
                            duration: 0.5,
                            ease: EASE_OUT,
                            delay: reduce ? 0 : month * 0.02 + index * 0.03,
                          }}
                        />
                        {entry.missingDays > 0 && (
                          <circle
                            cx={x + bar / 2}
                            cy={barTop - 5}
                            r={2.5}
                            fill="var(--danger)"
                          />
                        )}
                      </g>
                    );
                  }),
                )}
              </g>
            </svg>
          )}
          <AnimatePresence>
            {active !== null && (
              <motion.div
                key="tooltip"
                aria-hidden
                className="pointer-events-none absolute top-2 left-0 flex flex-col gap-1.5 rounded-lg bg-[rgb(24_24_27/0.9)] px-3 py-2.5 text-xs shadow-[0_4px_12px_rgb(0_0_0/0.15)] backdrop-blur-sm"
                style={{ width: TOOLTIP_WIDTH }}
                initial={{ opacity: 0, scale: 0.96, x: tooltipX }}
                animate={{ opacity: 1, scale: 1, x: tooltipX }}
                exit={{
                  opacity: 0,
                  scale: 0.96,
                  transition: { duration: 0.12 },
                }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <TooltipTitle>{MONTH_NAMES[active]}</TooltipTitle>
                {years.map((year, index) => {
                  const entry = months[active][index];
                  return (
                    <TooltipRow
                      key={year}
                      swatch={
                        <span
                          className="size-2 rounded-[2px]"
                          style={{
                            background:
                              direction === "consumption"
                                ? `color-mix(in oklab, var(--surface) ${30 + (70 * index) / Math.max(1, years.length - 1)}%, transparent)`
                                : yearColor(index, years.length, direction),
                          }}
                        />
                      }
                      label={String(year)}
                      value={
                        entry
                          ? `${formatNumber(entry.value, 0)} kWh${entry.missingDays > 0 ? "*" : ""}`
                          : "keine Daten"
                      }
                      tone={entry ? "default" : "muted"}
                    />
                  );
                })}
                {months[active].some((entry) => entry?.missingDays) && (
                  <p className="text-[11px] text-faint">
                    * SDAT-Tage fehlen, Wert zu tief
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <span />
        <div className="relative" aria-hidden>
          {ready &&
            MONTH_SHORT.map((name, month) => (
              <span
                key={name}
                className={cn(
                  "absolute top-0.5 -translate-x-1/2 text-[11px] text-faint transition-colors",
                  active === month && "text-foreground",
                )}
                style={{ left: month * group + group / 2 }}
              >
                {name}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
