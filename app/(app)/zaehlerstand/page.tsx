import type { Metadata } from "next";
import { MeterScreen } from "@/components/analysis/meter-screen";
import {
  exportBackHref,
  sensorFromParams,
} from "@/components/export/selection";

export const metadata: Metadata = { title: "Zählerstand" };

// ?sensor=ID735&von=2021-01-01&bis=2021-12-31, links from the export add quelle=export
export default async function MeterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sensor = sensorFromParams(params);
  const back = params.quelle === "export" ? exportBackHref(params) : null;
  return (
    <MeterScreen
      key={`${sensor}_${params.von}_${params.bis}`}
      params={params}
      sensor={sensor}
      back={back}
    />
  );
}
