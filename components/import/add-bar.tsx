"use client";

import { File as FileIcon, Folder, Upload } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// compact dropzone once data is there, dimmed and locked while an import runs
export function AddBar({
  dragging,
  disabled,
  onPickFiles,
  onPickFolder,
}: {
  dragging: boolean;
  disabled: boolean;
  onPickFiles: () => void;
  onPickFolder: () => void;
}) {
  return (
    <motion.section
      aria-label="Weitere Dateien hinzufügen"
      aria-disabled={disabled || undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: disabled ? 0.5 : 1, y: 0 }}
      className={cn(
        "flex items-center gap-3 rounded-card border-[1.5px] border-dashed py-3 pr-3 pl-3.5 transition-colors duration-200",
        dragging
          ? "border-primary bg-background"
          : "border-border-strong bg-surface",
      )}
    >
      <motion.span
        animate={dragging ? { scale: 1.1 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full shadow-card transition-colors duration-200",
          dragging
            ? "bg-primary text-primary-foreground"
            : "bg-card text-foreground",
        )}
      >
        <Upload className="size-4" aria-hidden />
      </motion.span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">
          {dragging ? "Dateien hier loslassen" : "Weitere Dateien hinzufügen"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {dragging
            ? "Nur .xml-Dateien werden eingelesen, alles andere wird übersprungen"
            : "Hierher ziehen oder auswählen · bereits importierte Werte werden erkannt"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={onPickFiles}
        >
          <FileIcon />
          Dateien auswählen
        </Button>
        <Button
          variant="outline"
          size="lg"
          disabled={disabled}
          onClick={onPickFolder}
        >
          <Folder />
          Ordner auswählen
        </Button>
      </div>
    </motion.section>
  );
}
