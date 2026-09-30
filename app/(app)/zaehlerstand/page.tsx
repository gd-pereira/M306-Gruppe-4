import type { Metadata } from "next";
import { METER_SCOPE } from "@/components/analysis/fake-analysis";
import { MeterScreen } from "@/components/analysis/meter-screen";
import { periodFromParams } from "@/components/analysis/period";
import {
  selectionFromParams,
  selectionParams,
} from "@/components/export/selection";

export const metadata: Metadata = { title: "Zählerstand" };

// ?sensor=ID735&von=2021-01-01&bis=2021-12-31, links from the export add quelle=export
export default async function MeterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = periodFromParams(params, METER_SCOPE);
  const selection = selectionFromParams(params);
  const back =
    params.quelle === "export" ? `/export?${selectionParams(selection)}` : null;
  return (
    <MeterScreen
      key={`${selection.sensor}_${initial.range.from}_${initial.range.to}`}
      initial={initial}
      sensor={selection.sensor}
      back={back}
    />
  );
}
