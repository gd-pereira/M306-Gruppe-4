"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { AddBar } from "./add-bar";
import { Dropzone } from "./dropzone";
import { demoFiles, isXml, type FileInfo } from "./fake-import";
import { FileTable, type FileTab } from "./file-table";
import { useFilePickers } from "./file-pickers";
import { IgnoredFilesDialog } from "./ignored-files-dialog";
import { ImportProgress } from "./import-progress";
import { ImportSkeleton } from "./import-skeleton";
import { ImportFailedAlert, ImportStatus } from "./import-status";
import { DeleteDataDialog } from "./delete-data-dialog";
import {
  cancelImport,
  deleteSavedData,
  startImport,
  useImportStore,
} from "./import-store";
import { ImportSummary } from "./import-summary";
import { ReplaceDataDialog } from "./replace-data-dialog";
import { useFileDrop } from "./use-file-drop";

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export function ImportScreen() {
  const { status, progress, failure, result, lastImport, restoring } =
    useImportStore();
  const importing = status === "importing";

  // files waiting for "Ersetzen und importieren"
  const [pending, setPending] = useState<FileInfo[] | null>(null);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // which result the tab belongs to, a new import starts on its own default tab
  const [tabState, setTabState] = useState<{
    result: typeof result;
    tab: FileTab;
  }>({ result: null, tab: "all" });

  const errorCount =
    result?.files.filter((f) => f.status === "error").length ?? 0;
  const ignoredFiles =
    result?.files.filter((f) => f.status === "ignored") ?? [];
  const tab: FileTab =
    tabState.result === result
      ? tabState.tab
      : errorCount > 0
        ? "error"
        : "all";
  const setTab = (next: FileTab) => setTabState({ result, tab: next });

  const period = result?.summary.period
    ? `${formatDate(result.summary.period.start)} – ${formatDate(result.summary.period.end)}`
    : null;

  function requestImport(files: FileInfo[]) {
    if (importing) return;
    // with nothing importable there is nothing to replace, the failure shows right away
    if (result && files.some((file) => isXml(file.name))) {
      setPending(files);
      return;
    }
    startImport(files);
  }

  const pickers = useFilePickers(requestImport);
  const { dragging, handlers } = useFileDrop(requestImport, !importing);

  return (
    <div {...handlers} className="flex min-h-0 flex-1 flex-col gap-5">
      {pickers.inputs}

      <AnimatePresence initial={false}>
        {status === "failed" && failure && (
          <ImportFailedAlert key="failed" message={failure} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {restoring && !result && !importing ? (
          // after a reload the saved import is still loading, the dropzone would flash
          <motion.div
            key="restoring"
            {...fade}
            className="flex flex-1 flex-col gap-5"
          >
            <ImportSkeleton />
          </motion.div>
        ) : !result && !importing ? (
          <motion.div
            key="empty"
            {...fade}
            className="flex flex-1 flex-col gap-5"
          >
            <Dropzone
              dragging={dragging}
              onPickFiles={pickers.openFiles}
              onPickFolder={pickers.openFolder}
              onLoadDemo={() => startImport(demoFiles())}
            />
          </motion.div>
        ) : (
          <motion.div
            key="data"
            {...fade}
            className="flex flex-1 flex-col gap-5"
          >
            <AddBar
              dragging={dragging}
              disabled={importing}
              onPickFiles={pickers.openFiles}
              onPickFolder={pickers.openFolder}
            />

            <AnimatePresence mode="wait" initial={false}>
              {importing && progress ? (
                <motion.div
                  key="progress"
                  {...fade}
                  className="flex flex-1 flex-col gap-5"
                >
                  <ImportProgress
                    processed={progress.processed}
                    total={progress.total}
                    onCancel={cancelImport}
                  />
                  <ImportSkeleton />
                </motion.div>
              ) : result && lastImport ? (
                <motion.div
                  key={`done-${lastImport.at}`}
                  className="flex flex-1 flex-col gap-5"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={{
                    animate: { transition: { staggerChildren: 0.07 } },
                    exit: { opacity: 0, transition: { duration: 0.15 } },
                  }}
                >
                  <motion.div variants={fade}>
                    <ImportStatus
                      total={lastImport.fileCount}
                      errors={errorCount}
                      onDelete={() => setDeleteOpen(true)}
                    />
                  </motion.div>
                  <motion.div
                    variants={fade}
                    className="flex flex-1 flex-col items-stretch gap-5 xl:flex-row"
                  >
                    <FileTable files={result.files} tab={tab} onTab={setTab} />
                    <ImportSummary
                      summary={result.summary}
                      errorCount={errorCount}
                      ignoredCount={ignoredFiles.length}
                      onShowErrors={() => setTab("error")}
                      onShowIgnored={() => setIgnoredOpen(true)}
                    />
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <ReplaceDataDialog
        open={pending !== null}
        fileCount={lastImport?.fileCount ?? 0}
        period={period}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) startImport(pending);
          setPending(null);
        }}
      />
      <DeleteDataDialog
        open={deleteOpen}
        fileCount={lastImport?.fileCount ?? 0}
        period={period}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          void deleteSavedData();
        }}
      />
      <IgnoredFilesDialog
        open={ignoredOpen}
        onOpenChange={setIgnoredOpen}
        files={ignoredFiles}
      />
    </div>
  );
}
