import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PageHeader
      title="Übersicht"
      description="Gesamter Zeitraum · 01.01.2018 – 06.09.2021"
      actions={
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Upload />
          Neu importieren
        </Link>
      }
    />
  );
}
