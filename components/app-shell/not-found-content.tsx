"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { LayoutDashboard, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const noSubscribe = () => () => {};

export function NotFoundContent() {
  // the 404 page is prerendered once, so the address only exists in the browser
  const pathname = useSyncExternalStore(
    noSubscribe,
    () => window.location.pathname,
    () => null,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <p className="text-[72px] font-semibold tracking-[-0.04em] text-neutral-200">
        404
      </p>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
        <p className="w-[420px] text-sm text-muted-foreground">
          Die Adresse {pathname ?? ""} gibt es in Flux nicht. Vielleicht ein
          alter Link oder ein Tippfehler.
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "brand", size: "lg" })}
        >
          <LayoutDashboard />
          Zum Dashboard
        </Link>
        <Link
          href="/import"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <Upload />
          Dateien importieren
        </Link>
      </div>
    </div>
  );
}
