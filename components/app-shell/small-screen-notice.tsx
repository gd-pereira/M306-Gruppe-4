"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Shield } from "lucide-react";
import { FluxLogo } from "@/components/brand/flux-logo";

function subscribe(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

export function SmallScreenNotice() {
  const width = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => null,
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-neutral-50 px-7 pt-14 pb-10 lg:hidden">
      <FluxLogo className="h-7 w-auto text-neutral-900" />

      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-14 items-center justify-center rounded-[14px] bg-card drop-shadow-[0_8px_14px_rgb(0_0_0/0.05)]">
          <Monitor className="size-6 text-neutral-900" aria-hidden />
        </div>
        <h1 className="text-[22px] font-semibold text-balance">
          Flux braucht einen grösseren Bildschirm
        </h1>
        <p className="text-sm leading-[21px] text-muted-foreground">
          Die Diagramme und Tabellen sind für den Desktop gemacht. Öffne Flux
          auf einem Laptop oder Monitor mit mindestens 1024 px Breite.
        </p>
        {width !== null && (
          <span className="rounded-full bg-secondary px-2.5 py-[5px] text-xs font-medium text-neutral-600">
            Aktuell {width} px · benötigt 1024 px
          </span>
        )}
      </div>

      <div className="flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground">
        <Shield className="size-4 shrink-0" aria-hidden />
        <p>
          Deine Daten bleiben lokal im Browser und werden nirgends hochgeladen.
        </p>
      </div>
    </div>
  );
}
