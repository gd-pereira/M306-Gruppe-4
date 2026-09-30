"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber } from "@/lib/format";

export function ReplaceDataDialog({
  open,
  fileCount,
  period,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  fileCount: number;
  period: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-[460px] gap-4">
        <div className="flex flex-col gap-2">
          <DialogTitle>Aktuelle Daten ersetzen?</DialogTitle>
          <DialogDescription>
            Es sind bereits {formatNumber(fileCount)} Dateien geladen
            {period && ` (${period})`}. Ein neuer Import ersetzt alle Daten,
            Diagramme und Kennzahlen.
          </DialogDescription>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <DialogClose render={<Button variant="outline" size="lg" />}>
            Abbrechen
          </DialogClose>
          <Button size="lg" onClick={onConfirm}>
            Ersetzen und importieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
