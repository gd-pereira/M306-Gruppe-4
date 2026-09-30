"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileRow, FileStatus } from "./fake-import";
import { Pagination, type PageSize } from "./pagination";
import {
  CountChip,
  FileName,
  SearchInput,
  SegmentedTabs,
  StatusBadge,
} from "./table-parts";

export type FileTab = "all" | "sdat" | "esl" | "ignored" | "error";
type SortKey = "name" | "type" | "sensor" | "from" | "status";
interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

// the default order puts problems first
const STATUS_RANK: Record<FileStatus, number> = {
  error: 0,
  imported: 1,
  ignored: 2,
};
const DEFAULT_SORT: Sort = { key: "status", dir: "asc" };
// dates are more useful newest first
const FIRST_DIR: Record<SortKey, Sort["dir"]> = {
  name: "asc",
  type: "asc",
  sensor: "asc",
  from: "desc",
  status: "asc",
};

const DIRECTION_LABEL = {
  consumption: "Bezug",
  feedIn: "Einspeisung",
  both: "Beide",
} as const;

function inTab(file: FileRow, tab: FileTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "sdat":
    case "esl":
      return file.type === tab && file.status === "imported";
    case "ignored":
    case "error":
      return file.status === tab;
  }
}

function compareBy(key: SortKey, a: FileRow, b: FileRow): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "type":
      return (a.type ?? "~").localeCompare(b.type ?? "~");
    case "sensor":
      return (a.sensor ?? "~").localeCompare(b.sensor ?? "~");
    case "from":
      return (a.from ?? -Infinity) - (b.from ?? -Infinity);
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  }
}

function sortFiles(files: FileRow[], sort: Sort): FileRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...files].sort(
    (a, b) =>
      sign * compareBy(sort.key, a, b) ||
      compareBy("from", b, a) ||
      a.name.localeCompare(b.name),
  );
}

const COLUMNS: { key: SortKey | null; label: string; width?: string }[] = [
  { key: "name", label: "Datei" },
  { key: "type", label: "Typ", width: "w-[60px]" },
  { key: "sensor", label: "Sensor", width: "w-[76px]" },
  { key: null, label: "Richtung", width: "w-[104px]" },
  { key: "from", label: "Daten vom", width: "w-[96px]" },
  { key: "status", label: "Status", width: "w-[116px]" },
];

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const { key, label } = column;
  if (key === null) {
    return <span className="text-xs font-medium">{label}</span>;
  }
  const active = sort.key === key;
  const Icon = !active
    ? ChevronsUpDown
    : sort.dir === "asc"
      ? ArrowDown
      : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(key)}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 text-xs font-medium transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden />
    </button>
  );
}

export function FileTable({
  files,
  tab,
  onTab,
}: {
  files: FileRow[];
  tab: FileTab;
  onTab: (tab: FileTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const counts = useMemo(() => {
    const count = (t: FileTab) => files.filter((f) => inTab(f, t)).length;
    return {
      sdat: count("sdat"),
      esl: count("esl"),
      ignored: count("ignored"),
      error: count("error"),
    };
  }, [files]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = files.filter(
      (f) =>
        inTab(f, tab) &&
        (!needle ||
          f.name.toLowerCase().includes(needle) ||
          f.sensor?.toLowerCase().includes(needle)),
    );
    return sortFiles(filtered, sort);
  }, [files, tab, query, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function changeSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    );
    setPage(1);
  }

  return (
    <section
      aria-labelledby="file-table-title"
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-card bg-card shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2 id="file-table-title" className="text-[15px] font-semibold">
            Dateien
          </h2>
          <CountChip count={files.length} />
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Datei oder Sensor suchen"
            className="w-[200px]"
          />
          <SegmentedTabs
            label="Dateien filtern"
            value={tab}
            onChange={(value) => {
              onTab(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Alle" },
              { value: "sdat", label: "SDAT", count: counts.sdat },
              { value: "esl", label: "ESL", count: counts.esl },
              { value: "ignored", label: "Ignoriert", count: counts.ignored },
              { value: "error", label: "Fehler", count: counts.error },
            ]}
          />
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[660px] table-fixed border-collapse text-left">
          <thead className="border-y border-border bg-surface text-muted-foreground">
            <tr>
              {COLUMNS.map((column, index) => (
                <th
                  key={column.label}
                  scope="col"
                  aria-sort={
                    column.key && sort.key === column.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(
                    "py-2.5 pr-3 text-xs font-normal",
                    column.width,
                    index === 0 && "pl-5",
                    index === COLUMNS.length - 1 && "pr-5",
                  )}
                >
                  <SortHeader column={column} sort={sort} onSort={changeSort} />
                </th>
              ))}
            </tr>
          </thead>
          {/* remounts on every page, filter or sort change so the rows fade in again */}
          <tbody
            key={`${tab}-${sort.key}-${sort.dir}-${currentPage}-${pageSize}`}
            className="text-[13px] text-soft-foreground"
          >
            {rows.map((file, index) => (
              <motion.tr
                key={file.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  ease: EASE_OUT,
                  delay: Math.min(index, 12) * 0.018,
                }}
                className="border-b border-muted transition-colors duration-150 hover:bg-surface"
              >
                <td className="py-[9px] pr-3 pl-5">
                  <div className="flex min-h-[25px] flex-col justify-center gap-[3px]">
                    <FileName name={file.name} />
                    {file.message && (
                      <span className="truncate font-mono text-[11px] text-danger-strong">
                        {file.message}
                      </span>
                    )}
                  </div>
                </td>
                <td className="truncate pr-3">
                  {file.type?.toUpperCase() ?? "–"}
                </td>
                <td className="truncate pr-3">{file.sensor ?? "–"}</td>
                <td className="truncate pr-3">
                  {file.direction ? DIRECTION_LABEL[file.direction] : "–"}
                </td>
                <td className="truncate pr-3 tabular-nums">
                  {file.from === null ? "–" : formatDate(file.from)}
                </td>
                <td className="pr-5">
                  <StatusBadge status={file.status} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-5 py-10 text-center text-[13px] text-muted-foreground"
          >
            {query
              ? "Keine Datei passt zur Suche."
              : "Keine Dateien in dieser Ansicht."}
          </motion.p>
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
    </section>
  );
}
