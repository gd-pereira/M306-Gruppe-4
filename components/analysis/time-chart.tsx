"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  useId,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { useElementSize } from "@/components/export/hooks";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { XTick } from "./chart-axes";
import type { ChartRegion } from "./fake-analysis";

export interface Scale {
  x: (ts: number) => number;
  y: (value: number) => number;
  width: number;
  height: number;
}

export interface HoverContent {
  x: number;
  // dots and lines inside the plot
  marks: ReactNode;
  tooltip: ReactNode;
}

const TOP_PAD = 8;
const MIN_TICK_GAP = 56;
const REGION_LABEL_MIN = 120;

// time on x, kWh on y. the series come from the page as svg children, hover and tooltip too
export function TimeChart({
  label,
  domain,
  yTicks,
  xTicks,
  regions,
  drawKey,
  yWidth = 36,
  tooltipWidth,
  layers,
  pick,
  hover,
  onSelect,
  selectHint,
  className,
}: {
  label: string;
  domain: [number, number];
  yTicks: number[];
  xTicks: XTick[];
  regions: ChartRegion[];
  // changes when the period changes, the lines draw in again
  drawKey: string;
  yWidth?: number;
  tooltipWidth: number;
  layers: (scale: Scale) => ReactNode;
  // index of the point under the pointer, null for none
  pick: (ts: number, secondsPerPixel: number) => number | null;
  hover: (index: number, scale: Scale) => HoverContent | null;
  // click in the plot, e.g. drill down to the clicked bucket
  onSelect?: (ts: number) => void;
  // last line of the tooltip when a click does something
  selectHint?: string;
  className?: string;
}) {
  const [plotRef, { width, height }] = useElementSize<HTMLDivElement>();
  const clipId = `plot-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [t0, t1] = domain;
  const bottom = yTicks[0] ?? 0;
  const top = yTicks[yTicks.length - 1] ?? 1;
  const scale: Scale = {
    width,
    height,
    x: (ts) => ((ts - t0) / Math.max(1, t1 - t0)) * width,
    y: (value) =>
      TOP_PAD +
      (1 - (value - bottom) / Math.max(1e-9, top - bottom)) *
        (height - TOP_PAD),
  };
  const ready = width > 0 && height > 0;

  // labels that would run into each other are left out
  const ticks: (XTick & { x: number })[] = [];
  for (const tick of xTicks) {
    const x = scale.x(tick.ts);
    if (x < 0 || x > width) continue;
    const previous = ticks[ticks.length - 1];
    if (previous && x - previous.x < MIN_TICK_GAP) continue;
    ticks.push({ ...tick, x });
  }

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("grid grid-rows-[1fr_18px] gap-y-1.5", className)}
      style={{ gridTemplateColumns: `${yWidth}px 1fr` }}
    >
      <div className="relative" aria-hidden>
        <AnimatePresence initial={false}>
          {ready && (
            <motion.div
              key={yTicks.join()}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3 }}
            >
              {yTicks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-2 -translate-y-1/2 text-[11px] text-faint tabular-nums"
                  style={{ top: scale.y(tick) }}
                >
                  {formatNumber(tick)}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={plotRef} className="relative min-h-0">
        {ready && (
          <>
            <svg
              className="absolute inset-0 overflow-visible"
              width={width}
              height={height}
              aria-hidden
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={0} y={-4} width={width} height={height + 8} />
                </clipPath>
              </defs>
              {yTicks.map((tick) => (
                <line
                  key={tick}
                  x1={0}
                  x2={width}
                  y1={scale.y(tick)}
                  y2={scale.y(tick)}
                  stroke="var(--muted)"
                />
              ))}
              <AnimatePresence initial={false}>
                {regions.map((region) => (
                  <RegionShape
                    key={`${drawKey}-${region.key}`}
                    region={region}
                    scale={scale}
                  />
                ))}
              </AnimatePresence>
              <g clipPath={`url(#${clipId})`}>{layers(scale)}</g>
            </svg>

            <AnimatePresence initial={false}>
              {regions.map((region) => (
                <RegionLabel
                  key={`${drawKey}-${region.key}`}
                  region={region}
                  scale={scale}
                />
              ))}
            </AnimatePresence>

            <HoverLayer
              scale={scale}
              domain={domain}
              tooltipWidth={tooltipWidth}
              pick={pick}
              hover={hover}
              onSelect={onSelect}
              selectHint={selectHint}
            />
          </>
        )}
      </div>

      <span />
      <div className="relative" aria-hidden>
        <AnimatePresence initial={false}>
          {ready && (
            <motion.div
              key={drawKey}
              className="absolute inset-0"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              {ticks.map((tick, index) => (
                <span
                  key={`${tick.ts}-${index}`}
                  className={cn(
                    "absolute top-0.5 text-[11px] whitespace-nowrap text-faint tabular-nums",
                    tick.x < 20
                      ? ""
                      : tick.x > width - 20
                        ? "-translate-x-full"
                        : "-translate-x-1/2",
                  )}
                  style={{ left: tick.x }}
                >
                  {tick.label}
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RegionShape({ region, scale }: { region: ChartRegion; scale: Scale }) {
  const x1 = Math.max(0, scale.x(region.from));
  const x2 = Math.min(scale.width, scale.x(region.to));
  if (x2 <= x1) return null;
  const edge = region.edge === "start" ? x1 : x2;
  const showEdge = edge > 0.5 && edge < scale.width - 0.5;
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      {region.fill && (
        <rect
          x={x1}
          y={0}
          width={x2 - x1}
          height={scale.height}
          fill="var(--surface)"
        />
      )}
      {showEdge && (
        <line
          x1={edge}
          x2={edge}
          y1={0}
          y2={scale.height}
          stroke="var(--border-strong)"
          strokeDasharray="3 3"
        />
      )}
    </motion.g>
  );
}

function RegionLabel({ region, scale }: { region: ChartRegion; scale: Scale }) {
  const x1 = Math.max(0, scale.x(region.from));
  const x2 = Math.min(scale.width, scale.x(region.to));
  if (x2 - x1 < REGION_LABEL_MIN) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.35, delay: 0.2, ease: EASE_OUT }}
      className={cn(
        "pointer-events-none absolute flex -translate-x-1/2 flex-col items-center gap-0.5 px-2 text-center text-[11px]",
        region.placement === "center"
          ? "top-1/2 -translate-y-1/2"
          : region.placement === "top"
            ? "top-3"
            : "bottom-6",
      )}
      style={{ left: (x1 + x2) / 2, maxWidth: x2 - x1 }}
    >
      <span className="font-medium text-muted-foreground">{region.label}</span>
      {region.sub && <span className="text-faint">{region.sub}</span>}
    </motion.div>
  );
}

const follow: Transition = { duration: 0.15, ease: EASE_OUT };

function HoverLayer({
  scale,
  domain,
  tooltipWidth,
  pick,
  hover,
  onSelect,
  selectHint,
}: {
  scale: Scale;
  domain: [number, number];
  tooltipWidth: number;
  pick: (ts: number, secondsPerPixel: number) => number | null;
  hover: (index: number, scale: Scale) => HoverContent | null;
  onSelect?: (ts: number) => void;
  selectHint?: string;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const content = index === null ? null : hover(index, scale);

  function pointer(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const secondsPerPixel = (domain[1] - domain[0]) / Math.max(1, rect.width);
    return { ts: domain[0] + px * secondsPerPixel, secondsPerPixel };
  }

  function onMove(event: PointerEvent<HTMLDivElement>) {
    const { ts, secondsPerPixel } = pointer(event);
    setIndex(pick(ts, secondsPerPixel));
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (!onSelect) return;
    // the index would point into the data of the next period
    setIndex(null);
    onSelect(pointer(event).ts);
  }

  const flip = content ? content.x + 16 + tooltipWidth > scale.width : false;
  const left = content
    ? flip
      ? content.x - 16 - tooltipWidth
      : content.x + 16
    : 0;

  return (
    <div
      className={cn("absolute inset-0", onSelect && "cursor-zoom-in")}
      onPointerMove={onMove}
      onPointerLeave={() => setIndex(null)}
      onClick={onClick}
    >
      {content && (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={scale.width}
          height={scale.height}
          aria-hidden
        >
          <line
            x1={content.x}
            x2={content.x}
            y1={0}
            y2={scale.height}
            stroke="var(--faint)"
            strokeDasharray="3 3"
          />
          {content.marks}
        </svg>
      )}
      <AnimatePresence>
        {content && (
          <motion.div
            key="tooltip"
            aria-hidden
            className="pointer-events-none absolute top-2 left-0 flex flex-col gap-1.5 rounded-lg bg-[rgb(24_24_27/0.9)] px-3 py-2.5 text-xs shadow-[0_4px_12px_rgb(0_0_0/0.15)] backdrop-blur-sm"
            style={{ width: tooltipWidth }}
            initial={{ opacity: 0, scale: 0.96, x: left }}
            animate={{ opacity: 1, scale: 1, x: left }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={follow}
          >
            {content.tooltip}
            {selectHint && (
              <p className="mt-0.5 border-t border-white/10 pt-1.5 text-[11px] text-faint">
                {selectHint}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TooltipTitle({ children }: { children: ReactNode }) {
  return <p className="font-medium text-faint">{children}</p>;
}

export function TooltipRow({
  swatch,
  label,
  value,
  tone = "default",
}: {
  swatch?: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "default" | "danger" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[#d4d4d4]">
        {swatch}
        {label}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "danger"
            ? "text-danger-border"
            : tone === "muted"
              ? "text-faint"
              : "text-[#fafafa]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// draws in from left to right when the period changes
export function DrawnPath({
  d,
  stroke,
  width = 1.75,
  dashed,
  delay = 0,
}: {
  d: string;
  stroke: string;
  width?: number;
  dashed?: boolean;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (dashed || reduce) {
    return (
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={dashed ? "4 4" : undefined}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.3 }}
      />
    );
  }
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
    />
  );
}

// nearest point by time, points must be sorted
export function nearestIndex(times: number[], ts: number): number | null {
  if (times.length === 0) return null;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < ts) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && ts - times[lo - 1] < times[lo] - ts) return lo - 1;
  return lo;
}
