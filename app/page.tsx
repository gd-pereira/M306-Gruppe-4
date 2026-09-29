import { FluxLogo } from "@/components/brand/flux-logo";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <h1>
        <FluxLogo className="h-16 w-auto text-foreground" />
      </h1>
      <p className="max-w-md text-lg text-pretty text-muted-foreground">
        SDAT- und ESL-Dateien einlesen, Verbrauch, Einspeisung und Zählerstand
        auswerten.
      </p>
      <p className="text-sm text-muted-foreground">
        Alle Daten werden lokal im Browser verarbeitet.
      </p>
    </main>
  );
}
