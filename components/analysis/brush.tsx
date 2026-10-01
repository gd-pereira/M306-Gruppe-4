"use client";

import { area, curveMonotoneX, line } from "d3-shape";
import { MoveHorizontal, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { AnimatedNumber, useElementSize } from "@/components/export/hooks";
import {
  addDays,
  daysBetween,
  formatDay,
  type DayKey,
  type DayRange,
} from "@/components/export/export-data";
import { cn } from "@/lib/utils";
import { localParts } from "./chart-axes";
import { useAnalysisData } from "./analysis-source";
import {
  rangeEnd,
  rangeStart,
  USAGE_SCOPE,
  usageBuckets,
  usageTotals,
  type UsageBucket,
} from "./analysis-data";
import {
  clampDay,
  intersect,
  isoWeek,
  MONTH_SHORT,
  periodFromRange,
  periodOf,
  shiftPeriod,
  type Period,
} from "./period";

const HEIGHT = 44;
const YEARS = [2018, 2019, 2020, 2021];

type Mode = "move" | "start" | "end" | "new";

interface Drag {
  mode: Mode;
  pointerX: number;
  origin: DayRange;
  anchor: DayKey;
  moved: boolean;
}

// «Apr 2021», «KW 14 · 2021», «03.02.20 – 17.03.20»
function selectionLabel(period: Period): string {
  const { level, range } = period;
  const [y, m] = range.from.split("-").map(Number);
  const short = (day: DayKey) => formatDay(day).replace(/\d{2}(\d{2})$/, "$1");
  switch (level) {
    case "day":
      return formatDay(range.from);
    case "week":
      return `KW ${isoWeek(range.from).week} · ${isoWeek(range.from).year}`;
    case "month":
      return `${MONTH_SHORT[m - 1]} ${y}`;
    case "year":
      return String(y);
    case "all":
      return "Alles";
    case "custom":
      return `${short(range.from)} – ${short(range.to)}`;
  }
}

const sameRange = (a: DayRange, b: DayRange) =>
  a.from === b.from && a.to === b.to;

// the whole period as a strip: drag the window, pull its handles or draw a new one
export function Brush({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const { data, all } = USAGE_SCOPE;
  const analysis = useAnalysisData();
  const months = useMemo(
    () => usageBuckets(all, "month", analysis),
    [all, analysis],
  );
  const t0 = rangeStart(all);
  const t1 = rangeEnd(all);
  const totalDays = daysBetween(all.from, all.to) + 1;
  const x = (ts: number) => ((ts - t0) / (t1 - t0)) * width;
  const dayAt = (px: number) => {
    const ratio = Math.min(Math.max(px / width, 0), 0.99999);
    return clampDay(localParts(t0 + ratio * (t1 - t0)).day, data);
  };

  const drag = useRef<Drag | null>(null);
  const [draft, setDraft] = useState<DayRange | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const current = intersect(period.range, data) ?? data;
  const full = sameRange(current, data);
  const shown = draft ?? current;
  const draftTotal = useMemo(
    () => (draft ? usageTotals(draft, analysis).consumption : 0),
    [draft, analysis],
  );

  const top = Math.max(1, ...months.map((m) => m.consumption ?? 0));
  const y = (m: UsageBucket) =>
    HEIGHT - 6 - ((m.consumption ?? 0) / top) * (HEIGHT - 14);
  const mid = (m: UsageBucket) => x((m.start + m.end) / 2);
  const fill =
    width > 0
      ? area<UsageBucket>().x(mid).y0(HEIGHT).y1(y).curve(curveMonotoneX)(
          months,
        )
      : null;
  const stroke =
    width > 0
      ? line<UsageBucket>().x(mid).y(y).curve(curveMonotoneX)(months)
      : null;

  const windowX = x(rangeStart(shown));
  const windowWidth = Math.max(6, x(rangeEnd(shown)) - windowX);
  const leftHandle = Math.max(1, windowX - 10);
  const rightHandle = Math.min(width - 9, windowX + windowWidth + 2);
  const center = windowX + windowWidth / 2;
  const showPill = draft !== null || period.level !== "all";
  const pillLabel = draft
    ? selectionLabel(periodFromRange(draft, USAGE_SCOPE))
    : selectionLabel(period);
  const pillX = Math.min(Math.max(center, 44), width - 44);
  const instant = { duration: 0 };
  const glide = { duration: 0.4, ease: EASE_OUT };

  function update(range: DayRange) {
    setDraft((previous) =>
      previous && sameRange(previous, range) ? previous : range,
    );
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || width === 0) return;
    const target = event.target as Element;
    const hit = (target.closest("[data-brush]")?.getAttribute("data-brush") ??
      "new") as Mode;
    // a window over everything has nothing to move, pressing it draws a new one
    const mode = hit === "move" && full ? "new" : hit;
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
    drag.current = {
      mode,
      pointerX: px,
      origin: current,
      anchor: dayAt(px),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setGrabbing(mode === "move");
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left;
    if (!d.moved && Math.abs(px - d.pointerX) < 3) return;
    d.moved = true;
    const day = dayAt(px);
    const { origin } = d;
    switch (d.mode) {
      case "move": {
        const delta = Math.round(((px - d.pointerX) / width) * totalDays);
        const shift = Math.min(
          Math.max(delta, daysBetween(origin.from, data.from)),
          daysBetween(origin.to, data.to),
        );
        update({
          from: addDays(origin.from, shift),
          to: addDays(origin.to, shift),
        });
        break;
      }
      case "start":
        update({ from: day < origin.to ? day : origin.to, to: origin.to });
        break;
      case "end":
        update({
          from: origin.from,
          to: day > origin.from ? day : origin.from,
        });
        break;
      case "new":
        update(
          day < d.anchor
            ? { from: day, to: d.anchor }
            : { from: d.anchor, to: day },
        );
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      if (draft && !sameRange(draft, current)) {
        onChange(periodFromRange(draft, USAGE_SCOPE));
      }
    } else if (d.mode === "new") {
      onChange(click(d.anchor));
    }
    setDraft(null);
    setGrabbing(false);
  }

  // a click keeps the level: in «April 2021» a click in 2019 opens that month, from «Alles» the year
  function click(day: DayKey): Period {
    const { level } = period;
    if (level === "all") return periodOf("year", day, USAGE_SCOPE);
    if (level !== "custom") return periodOf(level, day, USAGE_SCOPE);
    const half = Math.floor(daysBetween(current.from, current.to) / 2);
    const from = addDays(day, -half);
    const shift = Math.min(
      Math.max(0, daysBetween(from, data.from)),
      daysBetween(addDays(from, half * 2), data.to),
    );
    return periodFromRange(
      { from: addDays(from, shift), to: addDays(from, half * 2 + shift) },
      USAGE_SCOPE,
    );
  }

  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    const direction =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!direction) return;
    event.preventDefault();
    const next = shiftPeriod(period, direction, USAGE_SCOPE);
    if (next) onChange(next);
  }

  const yearX = (year: number) =>
    x(rangeStart({ from: `${year}-01-01`, to: `${year}-01-01` }));

  return (
    <div className="flex flex-col gap-2 border-t border-muted pt-3">
      <div className="flex h-4 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-medium">Übersicht</span>
          <AnimatePresence mode="popLayout" initial={false}>
            {draft ? (
              <motion.span
                key="total"
                className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <span className="font-medium text-foreground">
                  <AnimatedNumber value={draftTotal} decimals={1} /> kWh
                </span>
                Bezug im markierten Bereich
              </motion.span>
            ) : (
              <motion.span
                key="hint"
                className="flex min-w-0 items-center gap-1.5 text-[11px] text-faint"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <MoveHorizontal className="size-3 shrink-0" aria-hidden />
                <span className="truncate">
                  Fenster verschieben oder an den Griffen ziehen, um den
                  Zeitraum zu ändern
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {period.level !== "all" && (
            <motion.button
              type="button"
              onClick={() => onChange(periodOf("all", data.from, USAGE_SCOPE))}
              className="flex shrink-0 items-center gap-1 rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              whileTap={{ scale: 0.97 }}
            >
              <RotateCcw className="size-3" aria-hidden />
              Alles anzeigen
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div
        ref={ref}
        className={cn(
          "relative h-11 touch-none rounded-md bg-surface ring-1 ring-border select-none ring-inset",
          grabbing ? "cursor-grabbing" : "cursor-crosshair",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDraft(null);
          setGrabbing(false);
        }}
      >
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            className="absolute inset-0 overflow-visible"
          >
            {fill && (
              <path d={fill} fill="var(--border-strong)" fillOpacity={0.25} />
            )}
            {stroke && (
              <path
                d={stroke}
                fill="none"
                stroke="var(--border-strong)"
                strokeWidth={1}
              />
            )}
            {YEARS.slice(1).map((year) => (
              <line
                key={year}
                x1={yearX(year)}
                x2={yearX(year)}
                y1={1}
                y2={HEIGHT - 1}
                stroke="var(--border)"
              />
            ))}
            <motion.rect
              y={1}
              height={HEIGHT - 2}
              x={1}
              fill="var(--card)"
              fillOpacity={0.6}
              initial={false}
              animate={{ width: Math.max(0, windowX - 1) }}
              transition={draft ? instant : glide}
            />
            <motion.rect
              y={1}
              height={HEIGHT - 2}
              fill="var(--card)"
              fillOpacity={0.6}
              initial={false}
              animate={{
                x: windowX + windowWidth,
                width: Math.max(0, width - 1 - windowX - windowWidth),
              }}
              transition={draft ? instant : glide}
            />
            <motion.g
              data-brush="move"
              role="slider"
              tabIndex={0}
              aria-label="Angezeigter Zeitraum"
              aria-valuetext={selectionLabel(period)}
              aria-valuemin={0}
              aria-valuemax={totalDays}
              aria-valuenow={daysBetween(all.from, shown.from)}
              onKeyDown={onKeyDown}
              className={cn(
                "outline-none [&:focus-visible>rect]:stroke-ring",
                full ? "cursor-crosshair" : "cursor-grab",
              )}
            >
              <motion.rect
                y={1}
                height={HEIGHT - 2}
                rx={4}
                fill="var(--brand)"
                fillOpacity={0.22}
                stroke="var(--primary)"
                strokeWidth={1.5}
                initial={false}
                animate={{ x: windowX, width: windowWidth }}
                transition={draft ? instant : glide}
              />
            </motion.g>
            {[
              { mode: "start", at: leftHandle },
              { mode: "end", at: rightHandle },
            ].map((handle) => (
              <motion.g
                key={handle.mode}
                data-brush={handle.mode}
                className="cursor-ew-resize"
                initial={false}
                animate={{ x: handle.at }}
                transition={draft ? instant : glide}
              >
                <rect
                  x={-4}
                  y={0}
                  width={16}
                  height={HEIGHT}
                  fill="transparent"
                />
                <rect
                  y={12}
                  width={8}
                  height={20}
                  rx={3}
                  fill="var(--card)"
                  stroke="var(--primary)"
                  strokeWidth={1.25}
                />
                <line
                  x1={4}
                  x2={4}
                  y1={17}
                  y2={27}
                  stroke="var(--primary)"
                  strokeWidth={1}
                />
              </motion.g>
            ))}
          </svg>
        )}
      </div>

      <div className="relative h-5 text-[11px] text-faint" aria-hidden>
        {width > 0 &&
          YEARS.map((year) => {
            const labelX = (yearX(year) + Math.min(width, yearX(year + 1))) / 2;
            const hidden = showPill && Math.abs(labelX - pillX) < 56;
            return (
              <motion.span
                key={year}
                className="absolute top-[3px] -translate-x-1/2"
                style={{ left: labelX }}
                initial={false}
                animate={{ opacity: hidden ? 0 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {year}
              </motion.span>
            );
          })}
        <AnimatePresence initial={false}>
          {width > 0 && showPill && (
            <motion.div
              key="pill"
              className="absolute top-0 left-0"
              initial={{ opacity: 0, x: pillX, scale: 0.96 }}
              animate={{ opacity: 1, x: pillX, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={draft ? { ...glide, x: instant } : glide}
            >
              <span className="block -translate-x-1/2 rounded-full bg-primary px-2 py-[3px] leading-[14px] font-medium whitespace-nowrap text-primary-foreground tabular-nums">
                {pillLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
