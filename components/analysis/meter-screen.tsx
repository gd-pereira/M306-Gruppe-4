"use client";

import { ArrowLeft, Download } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useDataSummary } from "@/components/app-shell/use-data-summary";
import {
  addDays,
  formatDay,
  sensorInfo,
  SENSORS,
} from "@/components/export/fake-export";
import { selectionParams } from "@/components/export/selection";
import { SegmentedTabs } from "@/components/import/table-parts";
import { buttonVariants } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { SensorId } from "@/lib/types";
import { Breadcrumb, LevelToggle, Pager, usePeriod } from "./controls";
import {
  eslReadings,
  METER_SCOPE,
  rangeEnd,
  rangeStart,
  SDAT_END,
  SDAT_FACTOR,
  USAGE_SCOPE,
} from "./fake-analysis";
import { MeterChart } from "./meter-chart";
import {
  DotSwatch,
  LegendPill,
  LineSwatch,
  NoData,
  rise,
  stagger,
  Swap,
} from "./parts";
import { intersect, periodParams, periodTitle, type Period } from "./period";
import { SourcesCard } from "./sources-card";

const DESCRIPTION =
  "Absoluter Zählerstand aus den ESL-Ablesungen, dazwischen nach dem SDAT-Verlauf";

export function MeterScreen({
  initial,
  sensor,
  back,
}: {
  initial: Period;
  sensor: SensorId;
  // export url when the page was opened from the export
  back: string | null;
}) {
  const summary = useDataSummary();
  if (!summary) {
    return (
      <>
        <PageHeader title="Zählerstand" description={DESCRIPTION} />
        <NoData page="Zählerstand" />
      </>
    );
  }
  return <MeterView initial={initial} initialSensor={sensor} back={back} />;
}

const kwh = (value: number) => formatNumber(value, 1);

// «kWh · ESL 01.04. 50’273.4 → ESL 01.05. 51’392.8 · SDAT April …» when the period runs from reading to reading
function subtitle(sensor: SensorId, period: Period): string {
  const fallback = `kWh · absoluter Zählerstand ${sensor} · trifft jede ESL-Ablesung, dazwischen nach SDAT-Verlauf verteilt`;
  if (period.level === "all" || period.level === "custom") return fallback;
  const list = eslReadings(sensor);
  const first = list.find((reading) => reading.day === period.range.from);
  const last = list.find(
    (reading) => reading.day === addDays(period.range.to, 1),
  );
  if (!first || !last) return fallback;
  const date = (day: string) =>
    period.level === "month"
      ? `${day.slice(8)}.${day.slice(5, 7)}.`
      : formatDay(day);
  let text = `kWh · ESL ${date(first.day)} ${kwh(first.value)} → ESL ${date(last.day)} ${kwh(last.value)}`;
  const check = last.check;
  if (
    period.level === "month" &&
    check?.sdat != null &&
    check.missing.length === 0
  ) {
    text += ` · SDAT ${check.month} ${kwh(check.sdat)} kWh ÷ ${SDAT_FACTOR.toFixed(2)} = ${kwh(check.eslDiff)} kWh`;
  } else if (
    rangeEnd(period.range) > rangeStart({ from: SDAT_END, to: SDAT_END })
  ) {
    text += ` · ab ${formatDay(SDAT_END)} nur ESL-Ablesungen`;
  }
  return text;
}

function MeterView({
  initial,
  initialSensor,
  back,
}: {
  initial: Period;
  initialSensor: SensorId;
  back: string | null;
}) {
  const { period, direction, change } = usePeriod(initial);
  const [sensor, setSensor] = useState<SensorId>(initialSensor);
  const label = sensorInfo(sensor).label;
  const exportRange =
    intersect(period.range, USAGE_SCOPE.data) ?? USAGE_SCOPE.data;
  const exportHref = `/export?${selectionParams({ format: "csv", sensor, range: exportRange })}`;
  const titled = period.level !== "all" && period.level !== "custom";

  useEffect(() => {
    const params = new URLSearchParams({ sensor, ...periodParams(period) });
    if (back) params.set("quelle", "export");
    window.history.replaceState(null, "", `?${params}`);
  }, [sensor, period, back]);

  return (
    <>
      <PageHeader
        title="Zählerstand"
        description={
          back ? "Sensor und Zeitraum aus dem Export übernommen" : DESCRIPTION
        }
        actions={
          back ? (
            <Link
              href={back}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <ArrowLeft />
              Zurück zum Export
            </Link>
          ) : (
            <Link
              href={exportHref}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Download />
              Zählerstände exportieren
            </Link>
          )
        }
      />

      <motion.div {...stagger} className="flex flex-col gap-5">
        <motion.div
          variants={rise}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-4">
            <SegmentedTabs
              label="Sensor"
              size="md"
              value={sensor}
              onChange={setSensor}
              options={SENSORS.map((s) => ({ value: s.id, label: s.label }))}
            />
            <Breadcrumb period={period} scope={METER_SCOPE} onSelect={change} />
          </div>
          <div className="flex items-center gap-3">
            <Pager
              period={period}
              scope={METER_SCOPE}
              direction={direction}
              markPartial={false}
              onChange={change}
            />
            <LevelToggle
              period={period}
              scope={METER_SCOPE}
              onChange={change}
            />
          </div>
        </motion.div>

        <motion.section
          variants={rise}
          aria-label="Diagramm"
          className="flex flex-col gap-3 rounded-card bg-card px-5 py-4 shadow-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-[15px] font-semibold">
                <Swap
                  value={`Zählerstand ${label}${titled ? ` · ${periodTitle(period, METER_SCOPE)}` : ""}`}
                />
              </h2>
              <Swap
                value={subtitle(sensor, period)}
                className="text-xs text-muted-foreground"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LegendPill
                swatch={<LineSwatch color="var(--primary)" />}
                label="Berechnet"
              />
              <LegendPill
                swatch={<DotSwatch color="var(--primary)" />}
                label="ESL-Ablesung"
              />
              <LegendPill
                swatch={<DotSwatch color="var(--danger)" />}
                label="Unvollständiger Monat"
                bordered={false}
              />
            </div>
          </div>
          <MeterChart
            sensor={sensor}
            period={period}
            className="h-[clamp(260px,42vh,400px)]"
          />
        </motion.section>

        <SourcesCard sensor={sensor} period={period} />
      </motion.div>
    </>
  );
}
