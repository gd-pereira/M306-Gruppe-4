import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Zählerstand" };

export default function MeterReadingPage() {
  return (
    <PageHeader
      title="Zählerstand"
      description="Absoluter Zählerstand aus den ESL-Ablesungen, dazwischen nach dem SDAT-Verlauf"
    />
  );
}
