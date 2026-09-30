import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Verbrauch" };

export default function ConsumptionPage() {
  return (
    <PageHeader
      title="Verbrauch"
      description="Netzbezug und Einspeisung pro Zeitabschnitt"
    />
  );
}
