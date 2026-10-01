import { useImportStore } from "@/components/import/import-store";
import { dayOf, type DayRange } from "@/components/export/export-data";

export interface DataSummary {
  fileCount: number;
  consumptionKwh: number;
  feedInKwh: number;
  firstYear: number;
  lastYear: number;
  // first and last day with 15 minute values, in swiss time
  sdatPeriod: DayRange | null;
}

// swiss year: 01.01. 00:30 is still the old year in UTC
function yearOf(ts: number): number {
  return Number(dayOf(ts).slice(0, 4));
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
      ? // sdat.end is 00:00 after the last value, so the last day is the one before
        { from: dayOf(summary.sdat.start), to: dayOf(summary.sdat.end - 1) }
      : null,
  };
}
