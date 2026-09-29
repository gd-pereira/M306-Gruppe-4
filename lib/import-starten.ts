import type { ImportErgebnis, WorkerNachricht } from "@/lib/import";

// reads all files in a web worker (lib/import.worker.ts), so the page does not freeze
// beiFortschritt is called every few files, e.g. for the progress bar on the import page
// only works in the browser
export function importStarten(
  dateien: File[],
  beiFortschritt?: (fertig: number, total: number) => void,
): Promise<ImportErgebnis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url));

    worker.onmessage = (event: MessageEvent<WorkerNachricht>) => {
      const nachricht = event.data;

      if (nachricht.typ === "fortschritt") {
        beiFortschritt?.(nachricht.fertig, nachricht.total);
        return;
      }

      // done or failed, either way the worker is not needed anymore
      worker.terminate();
      if (nachricht.typ === "fertig") {
        resolve(nachricht.ergebnis);
      } else {
        reject(new Error(nachricht.meldung));
      }
    };

    // e.g. the worker file could not be loaded
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage(dateien);
  });
}
