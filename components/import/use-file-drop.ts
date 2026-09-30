import { useRef, useState, type DragEvent } from "react";

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer.types.includes("Files");
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

// readEntries returns at most 100 entries per call, so it is called until it returns none
async function readDirectory(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) {
      return files;
    }
    for (const found of await Promise.all(batch.map(readEntry))) {
      files.push(...found);
    }
  }
}

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return [await readFile(entry as FileSystemFileEntry)];
  }
  if (entry.isDirectory) {
    return readDirectory(entry as FileSystemDirectoryEntry);
  }
  return [];
}

// dropped files and folders, folders are walked recursively
// the entries have to be taken before the first await, the browser clears them afterwards
async function droppedFiles(data: DataTransfer): Promise<File[]> {
  const entries = [...data.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (entries.length === 0) {
    return [...data.files];
  }
  return (await Promise.all(entries.map(readEntry))).flat();
}

// drag and drop of files and folders onto an element
// the counter keeps "dragging" true while the pointer moves over child elements
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const handlers = {
    onDragEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current++;
      if (enabled) setDragging(true);
    },
    onDragOver(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = enabled ? "copy" : "none";
    },
    onDragLeave(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (!enabled) return;
      void droppedFiles(event.dataTransfer).then(onFiles);
    },
  };

  return { dragging, handlers };
}
