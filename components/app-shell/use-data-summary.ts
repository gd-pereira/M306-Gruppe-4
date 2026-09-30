export interface DataSummary {
  fileCount: number;
  consumptionKwh: number;
  feedInKwh: number;
  firstYear: number;
  lastYear: number;
}

// fake values from the mockup until the store (T3-2) exists, set to null to see the empty state
const FAKE_SUMMARY: DataSummary | null = {
  fileCount: 5180,
  consumptionKwh: 50865,
  feedInKwh: 16932,
  firstYear: 2018,
  lastYear: 2021,
};

// null = nothing imported yet
export function useDataSummary(): DataSummary | null {
  return FAKE_SUMMARY;
}
