import { useMemo } from "react";
import { useDataStore } from "@/lib/data-store";
import {
  emptyAnalysisData,
  realAnalysisData,
  type AnalysisData,
} from "./analysis-data";

// where the verbrauch and zählerstand pages take their values from: the imported data,
// empty before the first import. uses the store, so only for client components
export function useAnalysisData(): AnalysisData {
  const { result } = useDataStore();
  return useMemo(
    () => (result ? realAnalysisData(result) : emptyAnalysisData()),
    [result],
  );
}
