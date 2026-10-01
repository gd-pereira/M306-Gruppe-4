"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  Sun,
  TrendingUp,
  Upload,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { localParts } from "@/components/analysis/chart-axes";
import {
  ConsumptionChart,
  SERIES,
  type SeriesKey,
} from "@/components/analysis/consumption-chart";
import { useAnalysisData } from "@/components/analysis/analysis-source";
import type { Drill } from "@/components/analysis/controls";
import {
  eslReadings,
  USAGE_SCOPE,
  usageTotals,
  valueCount,
  yearTotals,
  type YearTotals,
} from "@/components/analysis/analysis-data";
import {
  KpiCard,
  LegendPill,
  LineSwatch,
  NoData,
  rise,
  stagger,
} from "@/components/analysis/parts";
import { useDataSummary } from "@/components/app-shell/use-data-summary";
import {
  intersect,
  periodOf,
  periodParams,
} from "@/components/analysis/period";
import {
  daysBetween,
  formatDay,
  type DayRange,
} from "@/components/export/export-data";
import { IgnoredFilesDialog } from "@/components/import/ignored-files-dialog";
import { useImportStore } from "@/components/import/import-store";
import { EASE_OUT } from "@/components/motion-provider";
import { buttonVariants } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL = periodOf("all", USAGE_SCOPE.data.to, USAGE_SCOPE);

const importButton = (
  <Link
    href="/import"
    className={buttonVariants({ variant: "outline", size: "lg" })}
  >
    <Upload />
    Neu importieren
  </Link>
);

export function DashboardScreen() {
  const { result, lastImport, restoring } = useImportStore();
  if (!result || !lastImport) {
    return (
      <>
        <PageHeader
          title="Übersicht"
          description={
            restoring
              ? "Gespeicherte Daten werden geladen"
              : "Noch keine Daten importiert"
          }
          actions={importButton}
        />
        <NoData page="Übersicht" article="Die" />
      </>
    );
  }
  const ignored = result.files.filter((file) => file.status === "ignored");
  return (
    <DashboardView
      ignored={ignored}
      placeholders={result.summary.replaced}
      fileCount={lastImport.fileCount}
      importedAt={lastImport.at}
    />
  );
}

const monthHref = (day: string) =>
  `/verbrauch?${new URLSearchParams(periodParams(periodOf("month", day, USAGE_SCOPE)))}`;

const yearHref = (year: number) =>
  `/verbrauch?${new URLSearchParams({ von: `${year}-01-01`, bis: `${year}-12-31` })}`;

// «Heute, 11:42» for today, otherwise the date
function importedLabel(ts: number): string {
  const { day, time } = localParts(ts);
  const today = localParts(Math.floor(Date.now() / 1000)).day;
  return `${day === today ? "Heute" : formatDay(day)}, ${time}`;
}

function DashboardView({
  ignored,
  placeholders,
  fileCount,
  importedAt,
}: {
  ignored: Parameters<typeof IgnoredFilesDialog>[0]["files"];
  placeholders: number;
  fileCount: number;
  importedAt: number;
}) {
  const router = useRouter();
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    consumption: true,
    feedIn: true,
  });
  const sdatPeriod = useDataSummary()?.sdatPeriod;
  const sdatFrom = sdatPeriod?.from;
  const sdatTo = sdatPeriod?.to;
  // the whole sdat period, the charts only cover the sample data years
  const data = useMemo(
    () =>
      (sdatFrom &&
        sdatTo &&
        intersect({ from: sdatFrom, to: sdatTo }, USAGE_SCOPE.data)) ||
      USAGE_SCOPE.data,
    [sdatFrom, sdatTo],
  );
  const analysis = useAnalysisData();
  const totals = useMemo(() => usageTotals(data, analysis), [data, analysis]);
  const years = useMemo(
    () =>
      yearTotals(analysis).flatMap((year) => {
        const range = intersect(year.range, data);
        return range
          ? [{ ...year, range, partial: range.to !== `${year.year}-12-31` }]
          : [];
      }),
    [analysis, data],
  );
  const values = useMemo(() => valueCount(analysis), [analysis]);
  const esl = eslReadings("ID742", analysis);
  const firstEsl = esl[0]?.day ?? null;
  const lastEsl = esl[esl.length - 1]?.day ?? null;
  const visibleCount = SERIES.filter((series) => visible[series.key]).length;
  const net = totals.consumption - totals.feedIn;
  const peak = totals.peak ? localParts(totals.peak.ts) : null;

  const drill: Drill = {
    selectHint: "Klicken öffnet den Verbrauch",
    onSelect: (ts) => router.push(monthHref(localParts(ts).day)),
  };

  return (
    <>
      <PageHeader
        title="Übersicht"
        description={`Gesamter Zeitraum · ${formatDay(data.from)} – ${formatDay(data.to)}`}
        actions={importButton}
      />
      <motion.div {...stagger} className="flex flex-col gap-5">
        <motion.div
          variants={stagger.variants}
          className="grid grid-cols-2 gap-5 xl:grid-cols-4"
        >
          <KpiCard
            icon={Zap}
            label="Bezug gesamt"
            value={totals.consumption}
            sub={`Netzbezug ${formatDay(data.from)} – ${formatDay(data.to)}`}
          />
          <KpiCard
            icon={Sun}
            label="Einspeisung gesamt"
            value={totals.feedIn}
            sub="Solarstrom ins Netz"
          />
          <KpiCard
            icon={TrendingUp}
            label="Spitzenwert"
            value={totals.peak?.value ?? null}
            sub={
              peak
                ? `in 15 Min. · ${formatDay(peak.day)}, ${peak.time}`
                : "keine SDAT-Daten"
            }
          />
          <KpiCard
            icon={Scale}
            label="Netto"
            value={net}
            sub={
              net < 0
                ? "mehr eingespeist als bezogen"
                : "Bezug minus Einspeisung"
            }
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <CardTitle
                  title="Monatswerte"
                  sub="kWh pro Monat · angebrochener Monat 09/2021 ausgeblendet"
                />
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
                  <LegendPill
                    bordered={false}
                    swatch={
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-danger"
                      />
                    }
                    label="Unvollständiger Monat"
                  />
                </div>
              </div>
              <ConsumptionChart
                period={ALL}
                visible={visible}
                drill={drill}
                markGaps
                className="h-[clamp(200px,26vh,260px)]"
              />
            </Card>

            <YearTable years={years} />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <h2 className="text-[15px] font-semibold">Hinweise</h2>
              <ul className="flex flex-col gap-3.5">
                {lastEsl && lastEsl > data.to && (
                  <Hint
                    icon={Info}
                    title={`SDAT-Daten enden am ${formatDay(data.to)}`}
                    text={`Danach nur noch ESL-Ablesungen (bis ${formatDay(lastEsl)}).`}
                  />
                )}
                {firstEsl && firstEsl > data.from && (
                  <Hint
                    icon={Info}
                    title={`Zählerstand ${data.from.slice(0, 4)} zurückgerechnet`}
                    text={`Vom ersten ESL-Wert (${formatDay(firstEsl)}) aus.`}
                  />
                )}
                <GapHint gaps={analysis.gaps} />
                {ignored.length > 0 && (
                  <Hint
                    icon={Info}
                    title={`${formatNumber(ignored.length)} ${ignored.length === 1 ? "Datei" : "Dateien"} ignoriert`}
                    text="Verarbeitet werden nur ID742 und ID735."
                    action={
                      <button
                        type="button"
                        onClick={() => setIgnoredOpen(true)}
                        className={hintLink}
                      >
                        Anzeigen
                      </button>
                    }
                  />
                )}
                {placeholders > 0 && (
                  <Hint
                    icon={CheckCircle2}
                    tone="success"
                    title={`${formatNumber(placeholders)} Platzhalter übersprungen`}
                    text="Nullwerte, der echte Wert kommt aus einer neueren Datei."
                  />
                )}
              </ul>
            </Card>

            <Card>
              <h2 className="text-[15px] font-semibold">Datenbestand</h2>
              <dl className="flex flex-col gap-2.5 text-xs">
                <Fact
                  label="Messwerte"
                  value={`${formatNumber(values * 2)} (2 × ${formatNumber(values)})`}
                />
                <Fact
                  label="SDAT-Zeitraum"
                  value={`${formatDay(data.from)} – ${formatDay(data.to)}`}
                />
                <Fact
                  label="ESL-Ablesungen"
                  value={
                    lastEsl
                      ? `${esl.length} pro Sensor, bis ${formatDay(lastEsl)}`
                      : "keine"
                  }
                />
                <Fact
                  label="Dateien"
                  value={
                    ignored.length > 0
                      ? `${formatNumber(fileCount)}, davon ${formatNumber(ignored.length)} ignoriert`
                      : formatNumber(fileCount)
                  }
                />
                <Fact
                  label="Letzter Import"
                  value={importedLabel(importedAt)}
                />
              </dl>
            </Card>
          </div>
        </div>
      </motion.div>

      <IgnoredFilesDialog
        open={ignoredOpen}
        onOpenChange={setIgnoredOpen}
        files={ignored}
      />
    </>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <motion.section
      variants={rise}
      className="flex flex-col gap-3 rounded-card bg-card px-5 py-4 shadow-card"
    >
      {children}
    </motion.section>
  );
}

function CardTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

const hintLink =
  "w-fit rounded-sm text-xs font-medium text-foreground underline decoration-border-strong underline-offset-[3px] transition-colors duration-150 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

function Hint({
  icon: Icon,
  title,
  text,
  action,
  tone = "default",
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <li className="flex gap-2.5">
      <Icon
        aria-hidden
        className={cn(
          "mt-px size-4 shrink-0",
          tone === "danger"
            ? "text-danger"
            : tone === "success"
              ? "text-success"
              : "text-muted-foreground",
        )}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
        {action}
      </div>
    </li>
  );
}

// «02/2020, 06/2020, 02/2021 und 03/2021 … (Lücken von 1–7 Tagen)»
function GapHint({ gaps }: { gaps: DayRange[] }) {
  const months = new Map<string, number>();
  for (const gap of gaps) {
    const key = `${gap.from.slice(5, 7)}/${gap.from.slice(0, 4)}`;
    months.set(key, (months.get(key) ?? 0) + daysBetween(gap.from, gap.to) + 1);
  }
  if (months.size === 0) return null;
  const names = [...months.keys()];
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
  const lengths = [...months.values()];
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const span = min === max ? `${min}` : `${min}–${max}`;
  return (
    <Hint
      icon={AlertTriangle}
      tone="danger"
      title={`${names.length} ${names.length === 1 ? "Monat" : "Monate"} unvollständig`}
      text={`${list}: Es fehlen SDAT-Werte (Lücken von ${span} ${max === 1 ? "Tag" : "Tagen"}).`}
      action={
        <Link href="/zaehlerstand" className={hintLink}>
          Im Zählerstand ansehen
        </Link>
      }
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="whitespace-nowrap text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function YearTable({ years }: { years: YearTotals[] }) {
  const top = Math.max(1, ...years.map((year) => year.consumption));
  const last = years[years.length - 1];
  return (
    <Card>
      <CardTitle
        title="Jahresvergleich"
        sub={`kWh pro Kalenderjahr${last?.partial ? ` · ${last.year} nur bis ${formatDay(last.range.to).slice(0, 6)}` : ""} · Jahr anklicken für Details`}
      />
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="w-16 pb-2 font-normal">Jahr</th>
            <th className="pb-2 font-normal">
              <span className="sr-only">Balken</span>
            </th>
            <th className="w-28 pb-2 text-right font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[2px] bg-primary" />
                Bezug
              </span>
            </th>
            <th className="w-28 pb-2 text-right font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[2px] bg-brand" />
                Einspeisung
              </span>
            </th>
            <th className="w-24 pb-2 text-right font-normal">Netto</th>
          </tr>
        </thead>
        <motion.tbody {...stagger}>
          {years.map((year) => (
            <motion.tr
              key={year.year}
              variants={rise}
              className="group relative border-t border-muted"
            >
              <td className="py-2.5">
                <Link
                  href={yearHref(year.year)}
                  className="flex flex-col rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span className="font-medium underline decoration-transparent underline-offset-[3px] transition-colors duration-150 group-hover:decoration-foreground">
                    {year.year}
                  </span>
                  {year.partial && (
                    <span className="text-[11px] text-faint">
                      bis {formatDay(year.range.to).slice(0, 6)}
                    </span>
                  )}
                </Link>
              </td>
              <td className="py-2.5 pr-6">
                <div className="flex flex-col gap-1">
                  <Bar share={year.consumption / top} className="bg-primary" />
                  <Bar share={year.feedIn / top} className="bg-brand" />
                </div>
              </td>
              <td className="py-2.5 text-right font-medium tabular-nums">
                {formatNumber(year.consumption, 1)}
              </td>
              <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                {formatNumber(year.feedIn, 1)}
              </td>
              <td className="py-2.5 text-right tabular-nums">
                {formatNumber(year.consumption - year.feedIn, 1)}
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </Card>
  );
}

function Bar({ share, className }: { share: number; className: string }) {
  return (
    <div className="h-1.5">
      <motion.div
        className={cn("h-full origin-left rounded-full", className)}
        style={{ width: `${Math.max(0, share) * 100}%` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
      />
    </div>
  );
}
