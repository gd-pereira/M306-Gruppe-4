import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ConsumptionScreen } from "@/components/analysis/consumption-screen";

export const metadata: Metadata = { title: "Verbrauch" };

// ?von=2021-04-01&bis=2021-04-30, the screen checks the days against the imported data
export default async function ConsumptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <PageHeader
        title="Verbrauch"
        description="Netzbezug und Einspeisung pro Zeitabschnitt"
      />
      {/* a link to another period (palette, «Zuletzt angesehen») starts the screen fresh */}
      <ConsumptionScreen key={`${params.von}_${params.bis}`} params={params} />
    </>
  );
}
