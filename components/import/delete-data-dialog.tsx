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

export function DeleteDataDialog({
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
          <DialogTitle>Gespeicherte Daten löschen?</DialogTitle>
          <DialogDescription>
            Die {formatNumber(fileCount)} importierten Dateien
            {period && ` (${period})`} werden aus diesem Browser gelöscht.
            Dashboard, Diagramme und Export sind danach leer, bis du wieder
            importierst. Die Dateien auf deinem Rechner bleiben unverändert.
          </DialogDescription>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <DialogClose render={<Button variant="outline" size="lg" />}>
            Abbrechen
          </DialogClose>
          <Button variant="destructive" size="lg" onClick={onConfirm}>
            Daten löschen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
