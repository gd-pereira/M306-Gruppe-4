import {
  addFile,
  buildResult,
  createParsedFiles,
  type WorkerMessage,
} from "@/lib/import";

// runs in its own thread, so the page stays usable while ~5'100 files are read
// started by startImport (lib/start-import.ts), gets the files and sends back the result

// a message after every file would be 5'000 messages, that slows down the page
const PROGRESS_EVERY = 50;

function send(message: WorkerMessage) {
  self.postMessage(message);
}

self.onmessage = async (event: MessageEvent<File[]>) => {
  const files = event.data;
  const parsed = createParsedFiles();

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      addFile(parsed, file.name, await file.text());

      const processed = i + 1;
      if (processed % PROGRESS_EVERY === 0 || processed === files.length) {
        send({ type: "progress", processed, total: files.length });
      }
    }

    send({ type: "result", result: buildResult(parsed) });
  } catch (error) {
    // the parsers never throw, so this would be a bug in our code
    send({ type: "error", message: String(error) });
  }
};
