import { useImportStore } from "@/components/import/import-store";

export interface DataSummary {
  fileCount: number;
  consumptionKwh: number;
  feedInKwh: number;
  firstYear: number;
  lastYear: number;
}

function yearOf(ts: number): number {
  return new Date(ts * 1000).getUTCFullYear();
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
  };
}
