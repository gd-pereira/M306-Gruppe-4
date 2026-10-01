"use client";

import { Scale, Sun, TrendingUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useDataSummary } from "@/components/app-shell/use-data-summary";
import { formatDay } from "@/components/export/fake-export";
import { localParts } from "./chart-axes";
import { Brush } from "./brush";
import { ConsumptionChart, SERIES, type SeriesKey } from "./consumption-chart";
import {
  Breadcrumb,
  drillProps,
  LevelToggle,
  Pager,
  usePeriod,
} from "./controls";
import { useAnalysisData } from "./analysis-source";
import { USAGE_SCOPE, usageTotals } from "./fake-analysis";
import {
  Badge,
  KpiCard,
  LegendPill,
  LineSwatch,
  NoData,
  rise,
  stagger,
  Swap,
} from "./parts";
import {
  periodParams,
  periodTitle,
  resolutionOf,
  type Period,
  type Resolution,
} from "./period";

const RESOLUTION_TITLE: Record<Resolution, string> = {
  "15min": "15-Minuten-Werte",
  hour: "Stundenwerte",
  day: "Tageswerte",
  week: "Wochenwerte",
  month: "Monatswerte",
};

const RESOLUTION_LABEL: Record<Resolution, string> = {
  "15min": "15 Min.",
  hour: "Stunde",
  day: "Tag",
  week: "Woche",
  month: "Monat",
};

export function ConsumptionScreen({ initial }: { initial: Period }) {
  const summary = useDataSummary();
  if (!summary) return <NoData page="Verbrauch" />;
  return <ConsumptionView initial={initial} />;
}

// «07.04., 11:00», with the year when the period spans more than one
function peakLabel(ts: number, withYear: boolean): string {
  const { day, time } = localParts(ts);
  const date = withYear
    ? formatDay(day)
    : `${day.slice(8)}.${day.slice(5, 7)}.`;
  return `${date}, ${time}`;
}

function ConsumptionView({ initial }: { initial: Period }) {
  const { period, direction, change } = usePeriod(initial);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    consumption: true,
    feedIn: true,
  });
  const data = useAnalysisData();
  const totals = useMemo(
    () => usageTotals(period.range, data),
    [period.range, data],
  );
  const resolution = resolutionOf(period);
  const net = totals.consumption - totals.feedIn;
  const withYear =
    period.range.from.slice(0, 4) !== period.range.to.slice(0, 4);
  const visibleCount = SERIES.filter((series) => visible[series.key]).length;

  // «Zuletzt angesehen» and reloads pick the period up from the url
  useEffect(() => {
    const params = new URLSearchParams(periodParams(period));
    window.history.replaceState(null, "", `?${params}`);
  }, [period]);

  return (
    <motion.div {...stagger} className="flex flex-col gap-5">
      <motion.div
        variants={rise}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <Breadcrumb period={period} scope={USAGE_SCOPE} onSelect={change} />
        <div className="flex items-center gap-3">
          <Pager
            period={period}
            scope={USAGE_SCOPE}
            direction={direction}
            markPartial
            onChange={change}
          />
          <LevelToggle period={period} scope={USAGE_SCOPE} onChange={change} />
        </div>
      </motion.div>

      <motion.div
        variants={stagger.variants}
        className="grid grid-cols-2 gap-5 xl:grid-cols-4"
      >
        <KpiCard
          icon={Zap}
          label="Bezug"
          value={totals.consumption}
          sub="im sichtbaren Bereich"
        />
        <KpiCard
          icon={Sun}
          label="Einspeisung"
          value={totals.feedIn}
          sub="im sichtbaren Bereich"
        />
        <KpiCard
          icon={TrendingUp}
          label="Spitzenwert"
          value={totals.peak?.value ?? null}
          sub={
            totals.peak
              ? `in 15 Min. · ${peakLabel(totals.peak.ts, withYear)}`
              : "keine SDAT-Daten im Zeitraum"
          }
        />
        <KpiCard
          icon={Scale}
          label="Netto"
          value={net}
          sub={
            net < 0 ? "mehr eingespeist als bezogen" : "Bezug minus Einspeisung"
          }
        />
      </motion.div>

      <motion.section
        variants={rise}
        aria-label="Diagramm"
        className="flex flex-col gap-3 rounded-card bg-card px-5 py-4 shadow-card"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 text-[15px] font-semibold">
              <Swap
                value={`${RESOLUTION_TITLE[resolution]} · ${periodTitle(period, USAGE_SCOPE)}`}
              />
            </h2>
            <Badge>Auflösung: {RESOLUTION_LABEL[resolution]}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {SERIES.map((series) => {
              const pressed = visible[series.key];
              return (
                <LegendPill
                  key={series.key}
                  swatch={
                    <LineSwatch
                      color={pressed ? series.color : "var(--faint)"}
                    />
                  }
                  label={series.label}
                  pressed={pressed}
                  disabled={pressed && visibleCount === 1}
                  onClick={() =>
                    setVisible((current) => ({
                      ...current,
                      [series.key]: !current[series.key],
                    }))
                  }
                />
              );
            })}
          </div>
        </div>
        <ConsumptionChart
          period={period}
          visible={visible}
          drill={drillProps(period, USAGE_SCOPE, change)}
          className="h-[clamp(260px,42vh,400px)]"
        />
        <Brush period={period} onChange={change} />
      </motion.section>
    </motion.div>
  );
}
