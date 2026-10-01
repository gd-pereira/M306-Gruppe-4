import { useMemo } from "react";
import { useDataStore } from "@/lib/data-store";
import {
  fakeAnalysisData,
  realAnalysisData,
  type AnalysisData,
} from "./fake-analysis";

// where the verbrauch and zählerstand pages take their values from: the real import as soon
// as there is one, the made-up data (demo) before that. uses the store, so only for client components
export function useAnalysisData(): AnalysisData {
  const { result } = useDataStore();
  return useMemo(
    () => (result ? realAnalysisData(result) : fakeAnalysisData()),
    [result],
  );
}
