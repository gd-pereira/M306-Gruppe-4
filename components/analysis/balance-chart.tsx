"use client";

import { curveMonotoneX, line } from "d3-shape";
import { motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { yTicks } from "@/components/export/export-data";
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
} from "./analysis-data";
import { pagerLabel, resolutionOf, type Period } from "./period";
import {
  DrawnPath,
  nearestIndex,
  TimeChart,
  TooltipRow,
  TooltipTitle,
  type Scale,
} from "./time-chart";

export const BALANCE_SERIES = [
  { key: "consumption", label: "Bezug", color: "var(--primary)" },
  { key: "feedIn", label: "Einspeisung", color: "var(--brand)" },
  { key: "net", label: "Netto", color: "var(--success)" },
] as const;

const BAR_MAX = 18;

// bezug up, einspeisung down from the same zero line, both with the same step
function balanceTicks(up: number, down: number): number[] {
  const step = yTicks(Math.max(up, down, 1), 2)[1];
  const ticks: number[] = [];
  for (let tick = -Math.ceil(down / step) * step; tick < 0; tick += step) {
    ticks.push(tick);
  }
  for (let tick = 0; tick <= Math.ceil(up / step) * step; tick += step) {
    ticks.push(tick);
  }
  return ticks.length > 1 ? ticks : [0, step];
}

const net = (bucket: UsageBucket) =>
  bucket.consumption === null || bucket.feedIn === null
    ? null
    : bucket.consumption - bucket.feedIn;

// composed chart: bars for bezug and einspeisung, the line shows what is left over
export function BalanceChart({
  period,
  drill,
  className,
}: {
  period: Period;
  drill?: Drill;
  className?: string;
}) {
  const { range } = period;
  const resolution = resolutionOf(period);
  const data = useAnalysisData();
  const reduce = useReducedMotion();
  const buckets = useMemo(
    () => usageBuckets(range, resolution, data),
    [range, resolution, data],
  );
  const regions = useMemo(() => usageRegions(range, data), [range, data]);
  const xTicks = useMemo(
    () => xTicksFor(range, resolution),
    [range, resolution],
  );
  const centers = useMemo(
    () => buckets.map((bucket) => (bucket.start + bucket.end) / 2),
    [buckets],
  );

  let up = 0;
  let down = 0;
  for (const bucket of buckets) {
    up = Math.max(up, bucket.consumption ?? 0);
    down = Math.max(down, bucket.feedIn ?? 0);
  }
  const ticks = balanceTicks(up, down);
  const drawKey = `${range.from}_${range.to}`;

  function layers(scale: Scale) {
    const zero = scale.y(0);
    const slot = buckets.length > 0 ? scale.width / buckets.length : 0;
    const width = Math.max(1, Math.min(BAR_MAX, slot * 0.36));
    const netLine = line<UsageBucket>()
      .defined((bucket) => net(bucket) !== null)
      .x((_, index) => scale.x(centers[index]))
      .y((bucket) => scale.y(net(bucket) ?? 0))
      .curve(curveMonotoneX)(buckets);
    return (
      <g key={drawKey}>
        {buckets.map((bucket, index) => {
          if (bucket.consumption === null || bucket.feedIn === null) {
            return null;
          }
          const x = scale.x(centers[index]);
          const top = scale.y(bucket.consumption);
          const bottom = scale.y(-bucket.feedIn);
          const delay = reduce ? 0 : Math.min(0.4, index * 0.004);
          return (
            <motion.g
              key={bucket.start}
              initial={{ scaleY: reduce ? 1 : 0, opacity: reduce ? 0 : 1 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay }}
              style={{
                transformBox: "view-box",
                transformOrigin: `0px ${zero}px`,
              }}
            >
              <rect
                x={x - width - 0.5}
                y={top}
                width={width}
                height={Math.max(0, zero - top)}
                rx={Math.min(2, width / 3)}
                fill="var(--primary)"
              />
              <rect
                x={x + 0.5}
                y={zero}
                width={width}
                height={Math.max(0, bottom - zero)}
                rx={Math.min(2, width / 3)}
                fill="var(--brand)"
              />
            </motion.g>
          );
        })}
        <line
          x1={0}
          x2={scale.width}
          y1={zero}
          y2={zero}
          stroke="var(--border-strong)"
        />
        <DrawnPath
          d={netLine ?? ""}
          stroke="var(--success)"
          width={2}
          delay={0.3}
        />
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
    const rest = net(bucket);
    const values = {
      consumption: bucket.consumption,
      feedIn: bucket.feedIn,
      net: rest,
    };
    return {
      x,
      marks:
        rest === null ? null : (
          <circle
            cx={x}
            cy={scale.y(rest)}
            r={4}
            fill="var(--card)"
            stroke="var(--success)"
            strokeWidth={2}
          />
        ),
      tooltip: (
        <>
          <TooltipTitle>{bucketTitle(bucket.start, resolution)}</TooltipTitle>
          {BALANCE_SERIES.map((series) => {
            const value = values[series.key];
            return (
              <TooltipRow
                key={series.key}
                swatch={
                  <span
                    className="size-2 rounded-[2px]"
                    style={{
                      background:
                        series.key === "consumption"
                          ? "var(--surface)"
                          : series.color,
                    }}
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
      label={`Bilanz ${pagerLabel(period)}: Bezug nach oben, Einspeisung nach unten, Netto als Linie, in kWh`}
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
