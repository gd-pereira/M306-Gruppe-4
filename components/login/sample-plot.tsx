"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { EASE_OUT } from "@/components/motion-provider";

const BEZUG =
  "M0 163.8L8.7 161.4L17.4 158.9L26 156.3L34.7 153.3L43.4 151.2L52.1 149.9L60.8 148.5L69.5 146.9L78.2 145.3L86.8 143.7L95.5 141.9L104.2 139.2L112.9 137L121.5 133.9L130.2 130.2L138.9 125.6L147.6 120.6L156.2 115.7L164.9 110.7L173.6 107.2L182.3 104.4L191 102.4L199.7 100.9L208.4 99.1L217.1 97.8L225.7 96.9L234.4 95.8L243.1 94.7L251.7 93.5L260.4 92L269.1 90.2L277.8 88.2L286.5 84.8L295.2 81.6L303.8 78.9L312.5 75.9L321.6 72.7L330.3 69.9L339 67.8L347.6 66.4L356.3 65L365 63.9L374.5 62.6L383.2 61.6L391.9 60.5L400.6 59L409.2 57.3L417.9 55.6L426.6 53.5L435.3 50.9L444 47.3L452.7 44.4L461.4 40.6L470 36.5L481.6 32.8L490.7 29.8L499.3 27.4L508 25.5L516.7 23.8L525.4 22.7L534.1 21.1L542.8 20L551.5 18.8L556 17.9";

const EINSPEISUNG =
  "M0 155.5L8.7 155.3L17.4 154.9L26 154.4L34.7 153.7L43.4 152.2L52.1 150L60.8 148.2L69.5 146.7L78.2 144.9L86.8 143.4L95.5 142.2L104.2 141.5L112.9 140.8L121.5 140.4L130.2 140.2H138.9H147.6H156.2H164.9L173.6 139.8L182.3 139.4L191 138.3L199.7 137.3L208.4 136.5L217.1 135.2L225.7 133.5L234.4 132.2L243.1 130.9L251.7 129.8L260.4 129L269.1 128.6L277.8 128.4L286.5 128.3L295.2 128.2H303.8L312.5 128.1L321.6 127.9L330.3 127.5L339 126.8L347.6 125.2L356.3 124L365 122.5L374.5 121.4L383.2 119.9L391.9 118.5L400.6 117.4L409.2 116.8L417.9 116.4L426.6 116.1L435.3 115.9H444H452.7H461.4L470 115.8L481.6 115.4L490.7 114.8L499.3 113.9L508 113L516.7 111.8L525.4 110.4L534.1 109.5L542.8 108.5L551.5 107.4L556 107";

const WIDTH = 556;
const HEIGHT = 176;
const GRID = [2, 59.3, 116.7, 174];
const YEARS = ["2018", "2019", "2020", "2021"];
const REVEAL = { duration: 1.4, delay: 0.5, ease: EASE_OUT };

const LINES = [
  { d: BEZUG, color: "var(--sidebar-accent-foreground)", top: 17.9 },
  { d: EINSPEISUNG, color: "var(--brand)", top: 107 },
];

// decorative sample for the lock screen, no real values behind it
export function SamplePlot() {
  return (
    <div aria-hidden>
      <div className="relative h-[176px]">
        <Lines />
        {LINES.map((line, i) => (
          <motion.span
            key={i}
            className="absolute -right-[3px] size-1.5 rounded-full"
            style={{ top: line.top - 3, backgroundColor: line.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.25,
              delay: REVEAL.delay + REVEAL.duration * 0.75,
              ease: EASE_OUT,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-sidebar-muted tabular-nums">
        {YEARS.map((year) => (
          <span key={year}>{year}</span>
        ))}
      </div>
    </div>
  );
}

// stretched to the card width, so strokes stay crisp via non-scaling-stroke
function Lines() {
  const id = useId();

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 size-full"
    >
      <defs>
        <clipPath id={`${id}-reveal`}>
          <motion.rect
            width={WIDTH}
            height={HEIGHT}
            style={{ originX: 0 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={REVEAL}
          />
        </clipPath>
      </defs>

      {GRID.map((y) => (
        <path
          key={y}
          d={`M0 ${y}H${WIDTH}`}
          stroke="var(--sidebar-subtle)"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <g clipPath={`url(#${id}-reveal)`}>
        {LINES.map((line, i) => (
          <path
            key={i}
            d={line.d}
            stroke={line.color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    </svg>
  );
}
