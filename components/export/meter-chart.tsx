"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { formatNumber } from "@/lib/format";
import { SENSOR_IDS, type SensorId } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addDays,
  axisLabels,
  BACKCALC_END,
  chartSeries,
  DATA_START,
  dayStart,
  rangeFraction,
  sensorInfo,
  yTicks,
  type ExportSelection,
} from "./export-data";
import { useExportSource } from "./export-source";
import { useElementSize } from "./hooks";

const TOP_PAD = 6;
const LINE = {
  [SENSOR_IDS.consumption]: {
    stroke: "var(--foreground)",
    label: "text-foreground",
  },
  [SENSOR_IDS.feedIn]: { stroke: "var(--brand)", label: "text-brand-label" },
} satisfies Record<SensorId, object>;

// small meter reading chart of the selected range: backcalculated 2018 in amber, gaps in red on the bar below
export function MeterChart({
  selection,
  dimmed,
}: {
  selection: ExportSelection;
  dimmed?: boolean;
}) {
  const [plotRef, { width, height }] = useElementSize<HTMLDivElement>();
  const { range } = selection;
  const source = useExportSource();
  const series = useMemo(
    () => chartSeries(selection, undefined, source),
    [selection, source],
  );
  const axis = useMemo(() => axisLabels(range), [range]);

  const values = series.flatMap((s) => s.points.map((p) => p.y));
  const max = Math.max(1, ...values);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const ticks = yTicks(max, height < 130 ? 2 : 3, min);
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  const y = (value: number) =>
    TOP_PAD + (1 - (value - bottom) / (top - bottom)) * (height - TOP_PAD);

  const backcalc = {
    from: rangeFraction(range, dayStart(DATA_START)),
    to: rangeFraction(range, dayStart(addDays(BACKCALC_END, 1))),
  };
  // both sensors have the same gaps
  const gaps = useMemo(
    () =>
      source[selection.sensor].gaps
        .map((gap) => ({
          from: rangeFraction(range, gap.start),
          to: rangeFraction(range, gap.end),
        }))
        .filter((gap) => gap.to > gap.from),
    [range, source, selection.sensor],
  );
  const drawKey = `${selection.format}-${selection.sensor}-${range.from}-${range.to}`;

  return (
    <div
      className={cn(
        "grid min-h-[110px] flex-1 grid-cols-[36px_1fr] grid-rows-[1fr_8px_12px] gap-y-1.5 text-[10px] transition-opacity duration-300",
        dimmed && "opacity-40",
      )}
      aria-hidden
    >
      <div className="relative">
        {height > 0 &&
          ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-2 -translate-y-1/2 text-faint tabular-nums"
              style={{ top: y(tick) }}
            >
              {formatNumber(tick)}
            </span>
          ))}
      </div>

      <div ref={plotRef} className="relative min-h-0">
        {backcalc.to > backcalc.from && (
          <motion.div
            key={`backcalc-${drawKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-y-0 bg-brand-soft"
            style={{
              left: `${backcalc.from * 100}%`,
              width: `${(backcalc.to - backcalc.from) * 100}%`,
            }}
          >
            {(backcalc.to - backcalc.from) * width > 90 && (
              <span className="absolute top-0.5 left-1 text-brand-strong">
                zurückgerechnet
              </span>
            )}
          </motion.div>
        )}

        {width > 0 && height > 0 && (
          <svg
            className="absolute inset-0 overflow-visible"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            {ticks.map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}
            {axis.lines.map((x) => (
              <line
                key={x}
                x1={x * width}
                x2={x * width}
                y1={0}
                y2={height}
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}
            {series.map((s) => (
              <motion.path
                key={`${s.sensor}-${drawKey}`}
                d={s.points
                  .map(
                    (p, i) =>
                      `${i === 0 ? "M" : "L"}${(p.x * width).toFixed(1)} ${y(p.y).toFixed(1)}`,
                  )
                  .join("")}
                fill="none"
                stroke={dimmed ? "var(--faint)" : LINE[s.sensor].stroke}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease: EASE_OUT }}
              />
            ))}
          </svg>
        )}

        {!dimmed &&
          height > 0 &&
          series.map((s) => {
            const last = s.points[s.points.length - 1];
            if (!last) return null;
            return (
              <motion.span
                key={`${s.sensor}-${drawKey}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.55 }}
                className={cn(
                  "absolute right-0 text-[11px] font-medium whitespace-nowrap tabular-nums",
                  LINE[s.sensor].label,
                )}
                style={{ top: y(last.y) - 18 }}
              >
                {sensorInfo(s.sensor).label} · {formatNumber(last.y)} kWh
              </motion.span>
            );
          })}
      </div>

      <span className="self-center text-muted-foreground">Werte</span>
      <motion.div
        key={`bar-${drawKey}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className={cn(
          "relative origin-left overflow-hidden rounded-[2px]",
          dimmed ? "bg-faint" : "bg-primary",
        )}
      >
        {backcalc.to > backcalc.from && (
          <div
            className="absolute inset-y-0 bg-[color-mix(in_srgb,var(--brand)_60%,white)]"
            style={{
              left: `${backcalc.from * 100}%`,
              width: `${(backcalc.to - backcalc.from) * 100}%`,
            }}
          />
        )}
        {gaps.map((gap) => (
          <div
            key={gap.from}
            className="absolute inset-y-0 min-w-[2px] bg-danger"
            style={{
              left: `${gap.from * 100}%`,
              width: `${(gap.to - gap.from) * 100}%`,
            }}
          />
        ))}
      </motion.div>

      <span />
      <div className="relative text-faint">
        {axis.labels.map((label) => (
          <span
            key={label.key}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap tabular-nums"
            style={{ left: `${label.x * 100}%` }}
          >
            {label.label}
          </span>
        ))}
      </div>
    </div>
  );
}
