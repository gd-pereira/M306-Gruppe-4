"use client";

import { area, curveMonotoneX, line } from "d3-shape";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { yTicks } from "@/components/export/fake-export";
import { formatNumber } from "@/lib/format";
import { bucketTitle, xTicksFor } from "./chart-axes";
import type { Drill } from "./controls";
import { useAnalysisData } from "./analysis-source";
import {
  rangeEnd,
  rangeStart,
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
  markGaps,
  className,
}: {
  period: Period;
  visible: Record<SeriesKey, boolean>;
  drill?: Drill;
  // red dot on buckets with missing sdat days
  markGaps?: boolean;
  className?: string;
}) {
  const { range } = period;
  const resolution = resolutionOf(period);
  const data = useAnalysisData();
  const buckets = useMemo(
    () => usageBuckets(range, resolution, data),
    [range, resolution, data],
  );
  // with the red dots the gap days need no shaded region
  const regions = useMemo(
    () => (markGaps ? [] : usageRegions(range, data)),
    [range, markGaps, data],
  );
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
        {markGaps && shown.length > 0 && (
          <g>
            {buckets.map((bucket, index) => {
              const value = bucket[shown[0].key];
              if (bucket.missingDays === 0 || value === null) return null;
              return (
                <motion.circle
                  key={bucket.start}
                  cx={scale.x(centers[index])}
                  cy={scale.y(value)}
                  r={3.5}
                  fill="var(--danger)"
                  stroke="var(--card)"
                  strokeWidth={1.5}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.25,
                    ease: EASE_OUT,
                    delay: 0.6 + index * 0.01,
                  }}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                  }}
                />
              );
            })}
          </g>
        )}
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
