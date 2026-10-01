"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import {
  Dialog,
  DialogCloseIcon,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { SENSOR_IDS } from "@/lib/types";
import type { FileRow } from "./import-view";
import { Pagination, type PageSize } from "./pagination";
import { CountChip, FileName, SearchInput, SegmentedTabs } from "./table-parts";

export function IgnoredFilesDialog({
  open,
  onOpenChange,
  files,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: FileRow[];
}) {
  const [query, setQuery] = useState("");
  const [sensor, setSensor] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const sensors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      counts.set(file.sensor!, (counts.get(file.sensor!) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [files]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files
      .filter(
        (f) =>
          (sensor === "all" || f.sensor === sensor) &&
          (!needle || f.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => (b.from ?? 0) - (a.from ?? 0));
  }, [files, sensor, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <DialogTitle>Ignorierte Dateien</DialogTitle>
              <CountChip count={files.length} />
            </div>
            <DialogDescription>
              Diese Dateien sind gültig, gehören aber zu Sensoren, die nicht
              ausgewertet werden. Verarbeitet werden nur{" "}
              {SENSOR_IDS.consumption} (Bezug) und {SENSOR_IDS.feedIn}{" "}
              (Einspeisung).
            </DialogDescription>
          </div>
          <DialogCloseIcon className="-mt-1 -mr-2 shrink-0" />
        </div>

        <div className="flex items-center gap-2">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Dateiname suchen"
            className="h-8 flex-1"
          />
          <SegmentedTabs
            label="Nach Sensor filtern"
            value={sensor}
            onChange={(value) => {
              setSensor(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Alle", count: files.length },
              ...sensors.map(([id, count]) => ({
                value: id,
                label: id,
                count,
              })),
            ]}
          />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-card border border-border">
          <div className="min-h-0 overflow-y-auto">
            <table className="w-full table-fixed border-collapse text-left">
              <thead className="border-b border-border bg-surface text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-4 font-medium">
                    Datei
                  </th>
                  <th scope="col" className="w-[108px] pr-3 font-medium">
                    Sensor
                  </th>
                  <th scope="col" className="w-[116px] pr-4 font-medium">
                    Daten vom
                  </th>
                </tr>
              </thead>
              <tbody
                key={`${sensor}-${currentPage}-${pageSize}`}
                className="text-[13px] text-soft-foreground"
              >
                {rows.map((file, index) => (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.28,
                      ease: EASE_OUT,
                      delay: Math.min(index, 12) * 0.018,
                    }}
                    className="border-b border-muted last:border-b-0"
                  >
                    <td className="h-9 pr-3 pl-4">
                      <FileName name={file.name} />
                    </td>
                    <td className="truncate pr-3">{file.sensor}</td>
                    <td className="truncate pr-4 tabular-nums">
                      {file.from === null ? "–" : formatDate(file.from)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                Keine Datei passt zur Suche.
              </p>
            )}
          </div>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            total={visible.length}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
