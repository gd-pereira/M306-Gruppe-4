"use client";

import { useMemo, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import {
  aggregateByMinutes,
  generateFakeData,
} from "@/components/prototype/fake-data";

const ZOOM_LEVELS = { "15 min": 15, Hour: 60, Day: 1440 } as const;
type ZoomLevel = keyof typeof ZOOM_LEVELS;

export default function PrototypePage() {
  const rawData = useMemo(() => generateFakeData(30), []);
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("Day");
  const data = useMemo(
    () => aggregateByMinutes(rawData, ZOOM_LEVELS[zoomLevel]),
    [rawData, zoomLevel],
  );

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">bklit prototype</h1>

      <div className="flex gap-2">
        {(Object.keys(ZOOM_LEVELS) as ZoomLevel[]).map((level) => (
          <button
            key={level}
            onClick={() => setZoomLevel(level)}
            className={`rounded border px-3 py-1 ${level === zoomLevel ? "bg-black text-white" : ""}`}
          >
            {level}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">{data.length} points per line</p>

      <LineChart key={zoomLevel} data={data}>
        <Grid horizontal />
        <Line dataKey="consumption" curve={curveMonotoneX} />
        <Line dataKey="feedIn" curve={curveMonotoneX} stroke="orange" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </main>
  );
}
