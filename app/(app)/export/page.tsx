import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Export" };

export default function ExportPage() {
  return (
    <PageHeader
      title="Export"
      description="Absolute Zählerstände in kWh als Datei speichern oder direkt an einen Server senden"
    />
  );
}
