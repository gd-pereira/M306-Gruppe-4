"use client";

import { useMemo, useState } from "react";
import { curveMonotoneX } from "@visx/curve";
import { LineChart, Line } from "@/components/charts/line-chart";
import { Grid } from "@/components/charts/grid";
import { XAxis } from "@/components/charts/x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { erzeugeFakeDaten, zusammenfassen } from "@/components/prototyp/fake-data";

const STUFEN = { "15 min": 15, Stunde: 60, Tag: 1440 } as const;
type Stufe = keyof typeof STUFEN;

export default function PrototypPage() {
  const rohdaten = useMemo(() => erzeugeFakeDaten(30), []);
  const [stufe, setStufe] = useState<Stufe>("Tag");
  const daten = useMemo(() => zusammenfassen(rohdaten, STUFEN[stufe]), [rohdaten, stufe]);

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">bklit-Prototyp</h1>

      <div className="flex gap-2">
        {(Object.keys(STUFEN) as Stufe[]).map((s) => (
          <button
            key={s}
            onClick={() => setStufe(s)}
            className={`rounded border px-3 py-1 ${s === stufe ? "bg-black text-white" : ""}`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-500">{daten.length} Punkte pro Linie</p>

      <LineChart key={stufe} data={daten}>
        <Grid horizontal />
        <Line dataKey="bezug" curve={curveMonotoneX} />
        <Line dataKey="einspeisung" curve={curveMonotoneX} stroke="orange" />
        <XAxis />
        <ChartTooltip />
      </LineChart>
    </main>
  );
}
