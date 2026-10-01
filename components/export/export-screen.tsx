"use client";

import { CircleAlert, Download } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EASE_OUT } from "@/components/motion-provider";
import { SegmentedTabs } from "@/components/import/table-parts";
import { toast } from "@/components/ui/toaster";
import { useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import type { SensorId } from "@/lib/types";
import { ApiAction, type ApiState } from "./api-action";
import { parseServerUrl, requestTarget, sendExport } from "./api-request";
import { DateField } from "./date-field";
import {
  buildFile,
  DATA_END,
  DATA_START,
  exportStats,
  formatBytes,
  formatDay,
  isValidRange,
  type DayRange,
  type ExportFormat,
  type ExportSelection,
} from "./fake-export";
import { useExportSource } from "./export-source";
import { ModeTiles, RangePresets } from "./form-parts";
import { PreviewCard } from "./preview-card";
import { selectionParams, type ExportMode } from "./selection";
import { SensorSelect } from "./sensor-select";
import { ServerUrlField } from "./server-url-field";
import { FileAction, SummaryCard } from "./summary-card";

const ALL: DayRange = { from: DATA_START, to: DATA_END };

const FORMAT_HINT: Record<ExportFormat, string> = {
  csv: "Eine Datei pro Sensor · Spalten timestamp, value · Unix-Zeit in Sekunden (UTC)",
  json: "Beide Sensoren in einer Datei · pro Sensor sensorId und data (ts, value)",
};

const rise = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
};

const swapMode = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export function ExportScreen({
  initial,
  initialMode,
}: {
  initial: ExportSelection;
  initialMode: ExportMode;
}) {
  const [mode, setMode] = useState<ExportMode>(initialMode);
  const [fileFormat, setFileFormat] = useState<ExportFormat>(initial.format);
  const [sensor, setSensor] = useState<SensorId>(initial.sensor);
  const [range, setRange] = useState<DayRange>(initial.range);
  const [downloading, setDownloading] = useState(false);
  const [url, setUrl] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [apiState, setApiState] = useState<ApiState>({ kind: "idle" });
  const request = useRef<AbortController | null>(null);

  const api = mode === "api";
  // the api always sends both sensors as json, like the json file
  const format: ExportFormat = api ? "json" : fileFormat;
  const valid = isValidRange(range);
  // an invalid range still shows the whole period, dimmed
  const selection = useMemo<ExportSelection>(
    () => ({ format, sensor, range: valid ? range : ALL }),
    [format, sensor, range, valid],
  );
  // real meter readings after an import, the demo curve before
  const source = useExportSource();
  // while the real import runs the screen still has the demo curve, so nothing may leave it
  const waiting = useDataStore().status === "importing";
  const stats = useMemo(
    () => exportStats(selection, source),
    [selection, source],
  );

  const server = parseServerUrl(url);
  const target = requestTarget(url);
  const urlStatus = !url.trim() ? "empty" : server ? "ok" : "invalid";
  const sending = apiState.kind === "sending";

  // keeps the settings in the url so "Zurück zum Export" and the back button land on the same state
  useEffect(() => {
    const params = selectionParams({ format: fileFormat, sensor, range }, mode);
    window.history.replaceState(null, "", `?${params}`);
  }, [fileFormat, sensor, range, mode]);

  useEffect(() => () => request.current?.abort(), []);

  // a result belongs to the url and range it was sent with
  function clearResult() {
    setApiState((state) => (state.kind === "done" ? { kind: "idle" } : state));
  }

  function changeRange(update: (prev: DayRange) => DayRange) {
    setRange(update);
    clearResult();
  }

  async function download() {
    if (!valid || downloading || waiting) return;
    setDownloading(true);
    const current = { selection, stats, source };
    try {
      const blob = await buildFile(current.selection, current.source);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = current.stats.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      const { from, to } = current.selection.range;
      toast({
        icon: <Download />,
        title: `${current.stats.fileName} heruntergeladen`,
        description: `${formatNumber(current.stats.values)} Werte · ${formatBytes(current.stats.bytes)} · ${formatDay(from)} – ${formatDay(to)}`,
      });
    } catch {
      toast({
        icon: <CircleAlert />,
        title: "Download fehlgeschlagen",
        description: "Die Datei konnte nicht erstellt werden.",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function send() {
    setUrlTouched(true);
    if (!server || !valid || sending || waiting) return;
    const controller = new AbortController();
    request.current = controller;
    const sent = {
      host: server.host,
      values: stats.values,
      sensors: stats.sensors.length,
    };
    setApiState({ kind: "sending", host: server.host });
    try {
      const result = await sendExport(server, range, controller.signal, source);
      setApiState({ kind: "done", result, ...sent });
    } catch {
      // cancelled because the page was left
    }
  }

  return (
    <motion.div
      className="flex min-h-0 flex-1 flex-col gap-5"
      initial="initial"
      animate="animate"
      variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
    >
      <motion.div variants={rise}>
        <ModeTiles value={mode} onChange={setMode} />
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <motion.section
            variants={rise}
            aria-label={api ? "An API senden" : "Datei"}
            className="relative flex flex-col rounded-card bg-card p-6 shadow-card"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {api ? (
                <motion.div key="api" {...swapMode}>
                  <ServerUrlField
                    value={url}
                    onChange={(value) => {
                      setUrl(value);
                      clearResult();
                    }}
                    onBlur={() => setUrlTouched(true)}
                    onSubmit={send}
                    invalid={urlTouched && urlStatus === "invalid"}
                    disabled={sending}
                  />
                </motion.div>
              ) : (
                <motion.div key="file" {...swapMode}>
                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-medium">Format</span>
                    <SegmentedTabs
                      label="Format"
                      size="md"
                      value={fileFormat}
                      onChange={setFileFormat}
                      options={[
                        { value: "csv", label: "CSV" },
                        { value: "json", label: "JSON" },
                      ]}
                    />
                    <div className="relative h-[15px] overflow-hidden">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.p
                          key={fileFormat}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{
                            opacity: 0,
                            y: -6,
                            transition: { duration: 0.12 },
                          }}
                          transition={{ duration: 0.25 }}
                          className="truncate text-xs text-muted-foreground"
                        >
                          {FORMAT_HINT[fileFormat]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {fileFormat === "csv" && (
                      <motion.div
                        key="sensor"
                        {...collapse}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <div className="pt-6">
                          <SensorSelect value={sensor} onChange={setSensor} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              layout="position"
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className="flex flex-col gap-2 pt-6"
            >
              <span className="text-[13px] font-medium" id="export-range-label">
                Zeitraum
              </span>
              <div
                role="group"
                aria-labelledby="export-range-label"
                className="flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <DateField
                    label="Von"
                    value={range.from}
                    min={DATA_START}
                    max={DATA_END}
                    onChange={(from) =>
                      changeRange((prev) => ({ ...prev, from }))
                    }
                  />
                  <span className="text-[13px] text-muted-foreground">bis</span>
                  <DateField
                    label="Bis"
                    value={range.to}
                    min={DATA_START}
                    max={DATA_END}
                    invalid={!valid}
                    onChange={(to) => changeRange((prev) => ({ ...prev, to }))}
                  />
                </div>
                <AnimatePresence initial={false}>
                  {!valid && (
                    <motion.p
                      key="error"
                      role="alert"
                      {...collapse}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="flex items-center gap-1.5 overflow-hidden text-xs text-danger-strong"
                    >
                      <CircleAlert
                        className="size-3.5 shrink-0 text-danger"
                        aria-hidden
                      />
                      Das Enddatum liegt vor dem Startdatum. Bitte den Zeitraum
                      anpassen.
                    </motion.p>
                  )}
                </AnimatePresence>
                <RangePresets
                  range={range}
                  onSelect={(next) => changeRange(() => next)}
                />
              </div>
            </motion.div>
          </motion.section>

          <motion.div variants={rise} className="flex min-h-0 flex-1 flex-col">
            <SummaryCard selection={selection} stats={stats} valid={valid}>
              {api ? (
                <ApiAction
                  selection={selection}
                  stats={stats}
                  valid={valid}
                  waiting={waiting}
                  url={urlStatus}
                  host={target.host}
                  state={apiState}
                  onSend={send}
                />
              ) : (
                <FileAction
                  selection={selection}
                  stats={stats}
                  valid={valid}
                  waiting={waiting}
                  downloading={downloading}
                  onDownload={download}
                />
              )}
            </SummaryCard>
          </motion.div>
        </div>

        <motion.div variants={rise} className="flex xl:w-[400px] xl:shrink-0">
          <PreviewCard
            selection={selection}
            stats={stats}
            valid={valid}
            waiting={waiting}
            request={api ? target : undefined}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
