import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ImportScreen } from "@/components/import/import-screen";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Daten importieren"
        description="SDAT- und ESL-Dateien einlesen. Die Verarbeitung läuft im Browser, nichts verlässt deinen Rechner."
      />
      <ImportScreen />
    </>
  );
}
