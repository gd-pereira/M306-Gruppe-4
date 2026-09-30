"use client";

import { line } from "d3-shape";
import { motion } from "motion/react";
import { useMemo } from "react";
import {
  daysBetween,
  formatDay,
  GAPS,
  yTicks,
} from "@/components/export/fake-export";
import { formatNumber } from "@/lib/format";
import type { SensorId } from "@/lib/types";
import { localParts, shortRange, xTicksFor } from "./chart-axes";
import type { Drill } from "./controls";
import {
  eslAround,
  eslReadings,
  FIRST_ESL,
  isIncomplete,
  meterLine,
  meterRegions,
  rangeEnd,
  rangeStart,
  sdatEndReading,
  type EslReading,
  type MeterPoint,
} from "./fake-analysis";
import { formatWeekday, pagerLabel, resolutionOf, type Period } from "./period";
import {
  DrawnPath,
  nearestIndex,
  TimeChart,
  TooltipRow,
  TooltipTitle,
  type HoverContent,
  type Scale,
} from "./time-chart";

// finer than the verbrauch: the meter line shows the course inside the buckets
function lineResolution(period: Period): "15min" | "hour" | "day" {
  switch (period.level) {
    case "day":
      return "15min";
    case "week":
    case "month":
      return "hour";
    case "year":
    case "all":
      return "day";
    case "custom": {
      const days = daysBetween(period.range.from, period.range.to) + 1;
      return days <= 2 ? "15min" : days <= 92 ? "hour" : "day";
    }
  }
}

// value on the straight line between the points, null outside
function interpolate(points: MeterPoint[], ts: number): number | null {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (ts >= a.ts && ts <= b.ts) {
      return a.value + ((b.value - a.value) * (ts - a.ts)) / (b.ts - a.ts);
    }
  }
  return null;
}

const kwh = (value: number) => `${formatNumber(value, 1)} kWh`;

function sourceOf(ts: number): string {
  const { day } = localParts(ts - 1);
  if (day < FIRST_ESL) return "Zurückgerechnet";
  if (GAPS.some((gap) => day >= gap.from && day <= gap.to)) {
    return "Lücke, gerade verbunden";
  }
  return "SDAT-Verlauf";
}

export function MeterChart({
  sensor,
  period,
  drill,
  className,
}: {
  sensor: SensorId;
  period: Period;
  drill?: Drill;
  className?: string;
}) {
  const { range } = period;
  const resolution = lineResolution(period);
  const t0 = rangeStart(range);
  const t1 = rangeEnd(range);
  const points = useMemo(
    () => meterLine(sensor, range, resolution),
    [sensor, range, resolution],
  );
  const esl = useMemo(
    () =>
      eslAround(sensor, range).filter(
        (reading) => reading.ts >= t0 && reading.ts <= t1,
      ),
    [sensor, range, t0, t1],
  );
  const dashed = useMemo(() => {
    const start = sdatEndReading(sensor);
    if (t1 <= start.ts) return [];
    const after = eslReadings(sensor)
      .filter((reading) => reading.ts > start.ts)
      .map(({ ts, value }) => ({ ts, value }));
    return [start, ...after];
  }, [sensor, t1]);
  const regions = useMemo(() => meterRegions(range), [range]);
  const xTicks = useMemo(
    () => xTicksFor(range, resolutionOf(period)),
    [range, period],
  );

  const values = [
    ...points.map((point) => point.value),
    ...esl.map((reading) => reading.value),
    ...dashed.filter((p) => p.ts >= t0 && p.ts <= t1).map((p) => p.value),
  ];
  for (const edge of [t0, t1]) {
    const value = interpolate(dashed, edge);
    if (value !== null) values.push(value);
  }
  const top = values.length > 0 ? Math.max(...values) : 1;
  const bottom = values.length > 0 ? Math.min(...values) : 0;
  const ticks = yTicks(top, 4, bottom);
  const drawKey = `${sensor}_${range.from}_${range.to}`;
  const lineTimes = points.map((point) => point.ts);
  const eslTimes = esl.map((reading) => reading.ts);

  function layers(scale: Scale) {
    const path = line<MeterPoint>()
      .x((p) => scale.x(p.ts))
      .y((p) => scale.y(p.value));
    return (
      <g key={drawKey}>
        {points.length > 1 && (
          <DrawnPath
            d={path(points) ?? ""}
            stroke="var(--primary)"
            width={1.75}
          />
        )}
        {dashed.length > 1 && (
          <DrawnPath
            d={path(dashed) ?? ""}
            stroke="var(--soft-foreground)"
            width={1.5}
            dashed
          />
        )}
        {esl.map((reading, index) => (
          <motion.circle
            key={reading.day}
            cx={scale.x(reading.ts)}
            cy={scale.y(reading.value)}
            r={3.5}
            fill="var(--card)"
            stroke={isIncomplete(reading) ? "var(--danger)" : "var(--primary)"}
            strokeWidth={1.5}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: 0.35 + index * 0.015 }}
          />
        ))}
      </g>
    );
  }

  // an esl point close to the pointer wins, otherwise the line
  function pick(ts: number, secondsPerPixel: number): number | null {
    const e = nearestIndex(eslTimes, ts);
    if (e !== null && Math.abs(eslTimes[e] - ts) <= 12 * secondsPerPixel) {
      return e;
    }
    const lastTs = lineTimes[lineTimes.length - 1];
    if (lastTs !== undefined && ts <= lastTs + 4 * secondsPerPixel) {
      const l = nearestIndex(lineTimes, ts);
      return l === null ? null : esl.length + l;
    }
    return e;
  }

  function hover(index: number, scale: Scale): HoverContent | null {
    if (index < esl.length) return eslHover(esl[index], scale);
    const point = points[index - esl.length];
    if (!point) return null;
    const x = scale.x(point.ts);
    const { day, time } = localParts(point.ts);
    return {
      x,
      marks: (
        <circle
          cx={x}
          cy={scale.y(point.value)}
          r={4}
          fill="var(--card)"
          stroke="var(--primary)"
          strokeWidth={2}
        />
      ),
      tooltip: (
        <>
          <TooltipTitle>
            {resolution === "day"
              ? formatWeekday(day)
              : `${formatWeekday(day)}, ${time}`}
          </TooltipTitle>
          <TooltipRow label="Zählerstand" value={kwh(point.value)} />
          <TooltipRow label="Quelle" value={sourceOf(point.ts)} tone="muted" />
        </>
      ),
    };
  }

  return (
    <TimeChart
      label={`Zählerstand ${sensor} ${pagerLabel(period)} in kWh`}
      domain={[t0, t1]}
      yTicks={ticks}
      xTicks={xTicks}
      regions={regions}
      drawKey={drawKey}
      yWidth={48}
      tooltipWidth={220}
      layers={layers}
      pick={pick}
      hover={hover}
      {...drill}
      className={className}
    />
  );
}

function eslHover(reading: EslReading, scale: Scale): HoverContent {
  const x = scale.x(reading.ts);
  const incomplete = isIncomplete(reading);
  const { check } = reading;
  return {
    x,
    marks: (
      <circle
        cx={x}
        cy={scale.y(reading.value)}
        r={5.5}
        fill="var(--card)"
        stroke={incomplete ? "var(--danger)" : "var(--primary)"}
        strokeWidth={2}
      />
    ),
    tooltip: (
      <>
        <TooltipTitle>{formatDay(reading.day)} · ESL-Ablesung</TooltipTitle>
        <TooltipRow label="Zählerstand" value={kwh(reading.value)} />
        {check ? (
          <>
            <TooltipRow
              label={`SDAT ${check.month}`}
              value={check.sdat === null ? "keine Daten" : kwh(check.sdat)}
              tone={check.sdat === null ? "muted" : "default"}
            />
            <TooltipRow label="ESL-Differenz" value={kwh(check.eslDiff)} />
            {incomplete && (
              <TooltipRow
                label="SDAT fehlt"
                value={check.missing.map(shortRange).join(", ")}
                tone="danger"
              />
            )}
          </>
        ) : (
          <TooltipRow label="Vormonat" value="erste Ablesung" tone="muted" />
        )}
      </>
    ),
  };
}
