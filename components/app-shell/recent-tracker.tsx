"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { RECORD_DELAY_MS, recordView, viewFromLocation } from "./recent-views";
import { useDataSummary } from "./use-data-summary";

// remembers the views for «Zuletzt angesehen», needs a Suspense boundary because of useSearchParams
export function RecentTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const hasData = useDataSummary() !== null;

  useEffect(() => {
    if (!hasData) return;
    const view = viewFromLocation(pathname, search);
    if (!view) return;
    const timer = setTimeout(() => recordView(view), RECORD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pathname, search, hasData]);

  return null;
}
