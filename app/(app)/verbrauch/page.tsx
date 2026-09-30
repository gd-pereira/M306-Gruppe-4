import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConsumptionScreen } from "@/components/analysis/consumption-screen";
import { USAGE_SCOPE } from "@/components/analysis/fake-analysis";
import { periodFromParams } from "@/components/analysis/period";

export const metadata: Metadata = { title: "Verbrauch" };

export default async function ConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = periodFromParams(await searchParams, USAGE_SCOPE);
  return (
    <>
      <PageHeader
        title="Verbrauch"
        description="Netzbezug und Einspeisung pro Zeitabschnitt"
      />
      {/* a link to another period (palette, «Zuletzt angesehen») starts the screen fresh */}
      <ConsumptionScreen
        key={`${initial.range.from}_${initial.range.to}`}
        initial={initial}
      />
    </>
  );
}
