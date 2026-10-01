"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/import/table-parts";
import type { Direction } from "@/lib/types";
import { BalanceChart, BALANCE_SERIES } from "./balance-chart";
import { drillProps } from "./controls";
import { HourHeatmap } from "./hour-heatmap";
import { MonthComparison } from "./month-comparison";
import { usageScope } from "./analysis-data";
import { useAnalysisData } from "./analysis-source";
import { LegendPill, LineSwatch, rise, stagger, Swap } from "./parts";
import { periodTitle, type Period } from "./period";

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "consumption", label: "Bezug" },
  { value: "feedIn", label: "Einspeisung" },
];

function InsightCard({
  label,
  title,
  sub,
  action,
  children,
}: {
  label: string;
  title: string;
  sub: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section
      variants={rise}
      aria-label={label}
      className="flex min-w-0 flex-col gap-3 rounded-card bg-card px-5 py-4 shadow-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="min-w-0 text-[15px] font-semibold">
            <Swap value={title} />
          </h2>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </motion.section>
  );
}

// the extra charts under the main chart: balance, daily profile and month comparison
export function ConsumptionInsights({
  period,
  onChange,
}: {
  period: Period;
  onChange: (period: Period) => void;
}) {
  const [profile, setProfile] = useState<Direction>("consumption");
  const [compare, setCompare] = useState<Direction>("consumption");
  const scope = usageScope(useAnalysisData());
  const title = periodTitle(period, scope);
  const { from, to } = scope.data;

  return (
    <motion.div variants={stagger.variants} className="flex flex-col gap-5">
      <InsightCard
        label="Bilanz"
        title={`Bilanz · ${title}`}
        sub="Bezug nach oben, Einspeisung nach unten, die Linie zeigt den Netto-Bezug"
        action={
          <div className="flex items-center gap-1">
            {BALANCE_SERIES.map((series) => (
              <LegendPill
                key={series.key}
                bordered={false}
                swatch={
                  series.key === "net" ? (
                    <LineSwatch color={series.color} />
                  ) : (
                    <span
                      aria-hidden
                      className="h-2.5 w-1.5 rounded-[2px]"
                      style={{ background: series.color }}
                    />
                  )
                }
                label={series.label}
              />
            ))}
          </div>
        }
      >
        <BalanceChart
          period={period}
          drill={drillProps(period, scope, onChange)}
          className="h-[clamp(220px,32vh,320px)]"
        />
      </InsightCard>

      <motion.div
        variants={stagger.variants}
        className="grid gap-5 xl:grid-cols-2"
      >
        <InsightCard
          label="Tagesprofil"
          title={`Tagesprofil · ${title}`}
          sub="Durchschnitt pro Wochentag und Stunde, Tage ohne SDAT ausgelassen"
          action={
            <SegmentedTabs
              label="Richtung Tagesprofil"
              options={DIRECTIONS}
              value={profile}
              onChange={setProfile}
            />
          }
        >
          <HourHeatmap range={period.range} direction={profile} />
        </InsightCard>

        <InsightCard
          label="Monatsvergleich"
          title={`Monatsvergleich · ${from.slice(0, 4)}–${to.slice(0, 4)}`}
          sub="Gleicher Monat über die Jahre, angebrochene Monate fehlen"
          action={
            <SegmentedTabs
              label="Richtung Monatsvergleich"
              options={DIRECTIONS}
              value={compare}
              onChange={setCompare}
            />
          }
        >
          <MonthComparison direction={compare} />
        </InsightCard>
      </motion.div>
    </motion.div>
  );
}
