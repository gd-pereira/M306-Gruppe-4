import {
  auswerten,
  dateiEinlesen,
  neueSammlung,
  type WorkerNachricht,
} from "@/lib/import";

// runs in its own thread, so the page stays usable while ~5'100 files are read
// started by importStarten (lib/import-starten.ts), gets the files and sends back the result

// a message after every file would be 5'000 messages, that slows down the page
const FORTSCHRITT_ALLE = 50;

function senden(nachricht: WorkerNachricht) {
  self.postMessage(nachricht);
}

self.onmessage = async (event: MessageEvent<File[]>) => {
  const dateien = event.data;
  const sammlung = neueSammlung();

  try {
    for (let i = 0; i < dateien.length; i++) {
      const datei = dateien[i];
      dateiEinlesen(sammlung, datei.name, await datei.text());

      const fertig = i + 1;
      if (fertig % FORTSCHRITT_ALLE === 0 || fertig === dateien.length) {
        senden({ typ: "fortschritt", fertig, total: dateien.length });
      }
    }

    senden({ typ: "fertig", ergebnis: auswerten(sammlung) });
  } catch (error) {
    // the parsers never throw, so this would be a bug in our code
    senden({ typ: "abbruch", meldung: String(error) });
  }
};
