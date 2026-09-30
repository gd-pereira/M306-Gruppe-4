import type { Metadata } from "next";
import { PageHeader } from "@/components/app-shell/page-header";
import { ExportScreen } from "@/components/export/export-screen";
import {
  modeFromParams,
  selectionFromParams,
  selectionParams,
} from "@/components/export/selection";

export const metadata: Metadata = { title: "Export" };

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = selectionFromParams(params);
  const mode = modeFromParams(params);
  return (
    <>
      <PageHeader
        title="Export"
        description="Absolute Zählerstände in kWh als Datei speichern oder direkt an einen Server senden"
      />
      {/* a link to other parameters (palette, «Zuletzt angesehen») starts the screen fresh */}
      <ExportScreen
        key={`${selectionParams(initial, mode)}`}
        initial={initial}
        initialMode={mode}
      />
    </>
  );
}
