import type { ImportResult, WorkerMessage } from "@/lib/import";

// reads all files in a web worker (lib/import.worker.ts), so the page does not freeze
// onProgress is called every few files, e.g. for the progress bar on the import page
// only works in the browser
export function startImport(
  files: File[],
  onProgress?: (processed: number, total: number) => void,
): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url));

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "progress") {
        onProgress?.(message.processed, message.total);
        return;
      }

      // done or failed, either way the worker is not needed anymore
      worker.terminate();
      if (message.type === "result") {
        resolve(message.result);
      } else {
        reject(new Error(message.message));
      }
    };

    // e.g. the worker file could not be loaded
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message));
    };

    worker.postMessage(files);
  });
}
