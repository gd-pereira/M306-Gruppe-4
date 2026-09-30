import { useImportStore } from "@/components/import/import-store";
import type { DayRange } from "@/components/export/fake-export";
import { formatDate } from "@/lib/format";

export interface DataSummary {
  fileCount: number;
  consumptionKwh: number;
  feedInKwh: number;
  firstYear: number;
  lastYear: number;
  // first and last day with 15 minute values, in swiss time
  sdatPeriod: DayRange | null;
}

function yearOf(ts: number): number {
  return new Date(ts * 1000).getUTCFullYear();
}

function dayOf(ts: number): string {
  const [day, month, year] = formatDate(ts).split(".");
  return `${year}-${month}-${day}`;
}

// null = nothing imported yet
export function useDataSummary(): DataSummary | null {
  const { result, lastImport } = useImportStore();
  if (!result || !lastImport) {
    return null;
  }
  const { summary } = result;
  return {
    fileCount: lastImport.fileCount,
    consumptionKwh: summary.kwh.consumption,
    feedInKwh: summary.kwh.feedIn,
    firstYear: summary.period ? yearOf(summary.period.start) : 0,
    lastYear: summary.period ? yearOf(summary.period.end) : 0,
    sdatPeriod: summary.sdat
      ? { from: dayOf(summary.sdat.start), to: dayOf(summary.sdat.end) }
      : null,
  };
}
