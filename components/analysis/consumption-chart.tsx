"use client";

import { area, curveMonotoneX, line } from "d3-shape";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { useElementSize } from "@/components/export/hooks";
import { yTicks } from "@/components/export/fake-export";
import { formatNumber } from "@/lib/format";
import { bucketTitle, xTicksFor } from "./chart-axes";
import type { Drill } from "./controls";
import {
  rangeEnd,
  rangeStart,
  USAGE_SCOPE,
  usageBuckets,
  usageRegions,
  type UsageBucket,
} from "./fake-analysis";
import { pagerLabel, resolutionOf, type Period } from "./period";
import {
  DrawnPath,
  nearestIndex,
  TimeChart,
  TooltipRow,
  TooltipTitle,
  type Scale,
} from "./time-chart";

export type SeriesKey = "consumption" | "feedIn";

export const SERIES: {
  key: SeriesKey;
  label: string;
  color: string;
  fillOpacity: number;
  // the black line needs a light swatch on the dark tooltip
  tooltipColor: string;
}[] = [
  {
    key: "consumption",
    label: "Bezug",
    color: "var(--primary)",
    fillOpacity: 0.05,
    tooltipColor: "var(--surface)",
  },
  {
    key: "feedIn",
    label: "Einspeisung",
    color: "var(--brand)",
    fillOpacity: 0.2,
    tooltipColor: "var(--brand)",
  },
];

export function ConsumptionChart({
  period,
  visible,
  drill,
  className,
}: {
  period: Period;
  visible: Record<SeriesKey, boolean>;
  drill?: Drill;
  className?: string;
}) {
  const { range } = period;
  const resolution = resolutionOf(period);
  const buckets = useMemo(
    () => usageBuckets(range, resolution),
    [range, resolution],
  );
  const regions = useMemo(() => usageRegions(range), [range]);
  const xTicks = useMemo(
    () => xTicksFor(range, resolution),
    [range, resolution],
  );
  const centers = useMemo(
    () => buckets.map((bucket) => (bucket.start + bucket.end) / 2),
    [buckets],
  );
  const shown = SERIES.filter((series) => visible[series.key]);

  let max = 0;
  for (const bucket of buckets) {
    for (const series of shown) {
      const value = bucket[series.key];
      if (value !== null && value > max) max = value;
    }
  }
  const ticks = yTicks(max, 4);
  const drawKey = `${range.from}_${range.to}`;

  function layers(scale: Scale) {
    const x = (_: UsageBucket, index: number) => scale.x(centers[index]);
    return (
      <g key={drawKey}>
        <AnimatePresence>
          {shown.map((series) => {
            const defined = (bucket: UsageBucket) =>
              bucket[series.key] !== null;
            const y = (bucket: UsageBucket) => scale.y(bucket[series.key] ?? 0);
            const fill = area<UsageBucket>()
              .defined(defined)
              .x(x)
              .y0(scale.y(ticks[0]))
              .y1(y)
              .curve(curveMonotoneX)(buckets);
            const stroke = line<UsageBucket>()
              .defined(defined)
              .x(x)
              .y(y)
              .curve(curveMonotoneX)(buckets);
            return (
              <motion.g
                key={series.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2 }}
              >
                <motion.path
                  d={fill ?? ""}
                  fill={series.color}
                  fillOpacity={series.fillOpacity}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                />
                <DrawnPath d={stroke ?? ""} stroke={series.color} />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </g>
    );
  }

  function pick(ts: number) {
    const index = nearestIndex(centers, ts);
    if (index === null) return null;
    const bucket = buckets[index];
    return Math.abs(centers[index] - ts) <= bucket.end - bucket.start
      ? index
      : null;
  }

  function hover(index: number, scale: Scale) {
    const bucket = buckets[index];
    if (!bucket) return null;
    const x = scale.x(centers[index]);
    return {
      x,
      marks: shown.map((series) => {
        const value = bucket[series.key];
        if (value === null) return null;
        return (
          <circle
            key={series.key}
            cx={x}
            cy={scale.y(value)}
            r={4}
            fill="var(--card)"
            stroke={series.color}
            strokeWidth={2}
          />
        );
      }),
      tooltip: (
        <>
          <TooltipTitle>{bucketTitle(bucket.start, resolution)}</TooltipTitle>
          {shown.map((series) => {
            const value = bucket[series.key];
            return (
              <TooltipRow
                key={series.key}
                swatch={
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: series.tooltipColor }}
                  />
                }
                label={series.label}
                value={
                  value === null
                    ? "keine Daten"
                    : `${formatNumber(value, 1)} kWh`
                }
                tone={value === null ? "muted" : "default"}
              />
            );
          })}
          {bucket.missingDays > 0 && (
            <TooltipRow
              label="SDAT fehlt"
              value={`${bucket.missingDays} ${bucket.missingDays === 1 ? "Tag" : "Tage"}`}
              tone="danger"
            />
          )}
        </>
      ),
    };
  }

  return (
    <TimeChart
      label={`Verbrauch ${pagerLabel(period)}: Bezug und Einspeisung in kWh`}
      domain={[rangeStart(range), rangeEnd(range)]}
      yTicks={ticks}
      xTicks={xTicks}
      regions={regions}
      drawKey={drawKey}
      tooltipWidth={184}
      layers={layers}
      pick={pick}
      hover={hover}
      {...drill}
      className={className}
    />
  );
}

// the whole period with the shown part marked, room for the brush of T4-7
export function Overview({ period }: { period: Period }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const all = USAGE_SCOPE.all;
  const months = useMemo(() => usageBuckets(all, "month"), [all]);
  const t0 = rangeStart(all);
  const t1 = rangeEnd(all);
  const x = (ts: number) => ((ts - t0) / (t1 - t0)) * width;
  const height = 32;
  const top = Math.max(1, ...months.map((m) => m.consumption ?? 0));
  const path =
    width > 0
      ? area<UsageBucket>()
          .x((m) => x((m.start + m.end) / 2))
          .y0(height)
          .y1((m) => height - 4 - ((m.consumption ?? 0) / top) * (height - 8))
          .curve(curveMonotoneX)(months)
      : null;

  const from = Math.max(t0, rangeStart(period.range));
  const to = Math.min(t1, rangeEnd(period.range));
  const windowWidth = Math.max(6, x(to) - x(from));
  const windowX = Math.min(x(from), width - windowWidth);
  const years = [2018, 2019, 2020, 2021];

  return (
    <div className="flex flex-col gap-1.5 border-t border-muted pt-3">
      <span className="text-xs font-medium text-soft-foreground">
        Übersicht
      </span>
      <div
        ref={ref}
        className="relative h-8 overflow-hidden rounded-md bg-surface"
      >
        {width > 0 && (
          <svg
            width={width}
            height={height}
            className="absolute inset-0"
            aria-hidden
          >
            {path && (
              <path d={path} fill="var(--border-strong)" fillOpacity={0.45} />
            )}
            {years.slice(1).map((year) => {
              const lineX = x(
                rangeStart({ from: `${year}-01-01`, to: `${year}-01-01` }),
              );
              return (
                <line
                  key={year}
                  x1={lineX}
                  x2={lineX}
                  y1={0}
                  y2={height}
                  stroke="var(--border)"
                />
              );
            })}
            <motion.rect
              y={0.5}
              height={height - 1}
              rx={4}
              fill="var(--brand)"
              fillOpacity={0.18}
              stroke="var(--brand)"
              initial={false}
              animate={{ x: windowX, width: windowWidth }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </svg>
        )}
      </div>
      <div className="relative h-4 text-[11px] text-faint" aria-hidden>
        {width > 0 &&
          years.map((year) => {
            const a = x(
              rangeStart({ from: `${year}-01-01`, to: `${year}-01-01` }),
            );
            const b = Math.min(
              width,
              x(
                rangeStart({
                  from: `${year + 1}-01-01`,
                  to: `${year + 1}-01-01`,
                }),
              ),
            );
            return (
              <span
                key={year}
                className="absolute -translate-x-1/2"
                style={{ left: (a + b) / 2 }}
              >
                {year}
              </span>
            );
          })}
      </div>
    </div>
  );
}
