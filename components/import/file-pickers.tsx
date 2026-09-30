"use client";

import { useRef, type ChangeEvent } from "react";

// hidden inputs behind the "Dateien auswählen" and "Ordner auswählen" buttons
export function useFilePickers(onFiles: (files: File[]) => void) {
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    // reset, so picking the same selection again still fires change
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  }

  const inputs = (
    <>
      <input
        ref={filesInput}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        hidden
        onChange={handleChange}
      />
      <input
        // react has no prop for it, the attribute turns the dialog into a folder picker
        ref={(input) => {
          folderInput.current = input;
          input?.setAttribute("webkitdirectory", "");
        }}
        type="file"
        hidden
        onChange={handleChange}
      />
    </>
  );

  return {
    inputs,
    openFiles: () => filesInput.current?.click(),
    openFolder: () => folderInput.current?.click(),
  };
}
