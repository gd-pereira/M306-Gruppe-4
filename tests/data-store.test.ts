import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelDataImport,
  getDataState,
  getRangeData,
  importFiles,
  resetDataStore,
  restoreDataStore,
  setRange,
} from "@/lib/data-store";
import {
  addFile,
  buildResult,
  createParsedFiles,
  type ImportResult,
} from "@/lib/import";
import { loadData, saveData } from "@/lib/saved-data";
import { startImport } from "@/lib/start-import";

// the real startImport needs a web worker, node has none
vi.mock("@/lib/start-import", () => ({ startImport: vi.fn() }));
const startImportMock = vi.mocked(startImport);

// node has no IndexedDB either, the saved data is checked through the calls
vi.mock("@/lib/saved-data", () => ({
  saveData: vi.fn(async () => {}),
  loadData: vi.fn(async () => null),
}));
const saveDataMock = vi.mocked(saveData);
const loadDataMock = vi.mocked(loadData);

const FIXTURES = ["sdat-ID742.xml", "sdat-ID735.xml", "esl-2019-03.xml"];

// the same result the worker would send for the fixture files
function fixtureResult() {
  const parsed = createParsedFiles();
  for (const name of FIXTURES) {
    addFile(parsed, name, readFileSync(`tests/fixtures/${name}`, "utf-8"));
  }
  return buildResult(parsed);
}

const files = FIXTURES.map((name) => new File([], name));

describe("data store", () => {
  beforeEach(() => {
    resetDataStore();
    startImportMock.mockReset();
    saveDataMock.mockClear();
    loadDataMock.mockReset();
    loadDataMock.mockResolvedValue(null);
  });

  it("starts empty", () => {
    expect(getDataState().status).toBe("empty");
    expect(getRangeData("day")).toBeNull();
  });

  it("import sets data, whole range and last import", async () => {
    const result = fixtureResult();
    startImportMock.mockImplementation(async (_files, onProgress) => {
      onProgress?.(3, 3);
      return result;
    });

    const running = importFiles(files);
    expect(getDataState().status).toBe("importing");
    await running;

    const state = getDataState();
    expect(state.status).toBe("ready");
    expect(state.progress).toBeNull();
    expect(state.result).toBe(result);
    expect(state.lastImport?.fileCount).toBe(3);
    expect(state.range).toEqual(state.bounds);

    // first esl reading (01.02.2019) until the end of the last 15 min value (12.03.2019)
    const { esl, usage } = result.consumption;
    expect(state.bounds).toEqual({
      from: esl[0].ts,
      to: usage["15min"][95].ts + 15 * 60,
    });
  });

  it("gives only the values in the range", async () => {
    startImportMock.mockResolvedValue(fixtureResult());
    await importFiles(files);
    const { result } = getDataState();
    const firstValue = result!.consumption.usage["15min"][0].ts;

    // first hour of the sdat day
    setRange(firstValue, firstValue + 60 * 60);
    const data = getRangeData("15min")!;

    expect(data.consumption.usage).toHaveLength(4);
    expect(data.feedIn.usage).toHaveLength(4);
    expect(data.consumption.esl).toEqual([]);
  });

  it("keeps the bucket the range starts in", async () => {
    startImportMock.mockResolvedValue(fixtureResult());
    await importFiles(files);
    const firstValue = getDataState().result!.consumption.usage["15min"][0].ts;

    // starts at noon, the day bucket starts at midnight and still counts
    setRange(firstValue + 12 * 60 * 60, firstValue + 13 * 60 * 60);

    expect(getRangeData("day")!.consumption.usage).toEqual(
      getDataState().result!.consumption.usage.day,
    );
  });

  it("setRange accepts from and to in any order", () => {
    setRange(200, 100);

    expect(getDataState().range).toEqual({ from: 100, to: 200 });
  });

  it("a crashed import keeps the old data", async () => {
    const result = fixtureResult();
    startImportMock.mockResolvedValueOnce(result);
    await importFiles(files);

    startImportMock.mockRejectedValueOnce(new Error("worker gone"));
    await importFiles(files);

    const state = getDataState();
    expect(state.status).toBe("failed");
    expect(state.failure).toBe("worker gone");
    expect(state.result).toBe(result);
  });

  it("a reset during an import is not undone by it", async () => {
    let finish: (result: ImportResult) => void = () => {};
    startImportMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );

    const running = importFiles(files);
    resetDataStore();
    finish(fixtureResult());
    await running;

    expect(getDataState()).toMatchObject({ status: "empty", result: null });
  });

  it("meter readings are filtered like the usage", async () => {
    startImportMock.mockResolvedValue(fixtureResult());
    await importFiles(files);
    const { consumption } = getDataState().result!;
    const firstValue = consumption.usage["15min"][0].ts;

    setRange(firstValue, firstValue + 60 * 60);
    const data = getRangeData("15min")!;

    expect(data.consumption.meterReading).toEqual(
      consumption.meterReading["15min"].slice(0, 4),
    );
  });

  it("ignores a second import while one is running", async () => {
    startImportMock.mockResolvedValue(fixtureResult());

    const first = importFiles(files);
    await importFiles(files);
    await first;

    expect(startImportMock).toHaveBeenCalledTimes(1);
  });
});

describe("saved data", () => {
  beforeEach(() => {
    resetDataStore();
    startImportMock.mockReset();
    saveDataMock.mockClear();
    loadDataMock.mockReset();
    loadDataMock.mockResolvedValue(null);
  });

  it("saves the result of an import", async () => {
    const result = fixtureResult();
    startImportMock.mockResolvedValue(result);
    await importFiles(files);

    expect(saveDataMock).toHaveBeenCalledTimes(1);
    expect(saveDataMock).toHaveBeenCalledWith("data", {
      result,
      lastImport: getDataState().lastImport,
    });
  });

  it("saves nothing when the import crashes", async () => {
    startImportMock.mockRejectedValue(new Error("kaputt"));
    await importFiles(files);
    expect(saveDataMock).not.toHaveBeenCalled();
  });

  it("restores the saved result after a reload", async () => {
    const result = fixtureResult();
    const lastImport = { at: 100, fileCount: 3 };
    loadDataMock.mockResolvedValue({ result, lastImport });

    expect(await restoreDataStore()).toBe(true);
    const state = getDataState();
    expect(state).toMatchObject({ status: "ready", result, lastImport });
    expect(state.range).toEqual(state.bounds);
    expect(getRangeData("day")).not.toBeNull();
  });

  it("stays empty when nothing is saved", async () => {
    expect(await restoreDataStore()).toBe(false);
    expect(getDataState().status).toBe("empty");
  });

  it("an import started during the restore wins", async () => {
    const saved = {
      result: fixtureResult(),
      lastImport: { at: 1, fileCount: 3 },
    };
    let load: (value: unknown) => void = () => {};
    loadDataMock.mockReturnValue(new Promise((resolve) => (load = resolve)));
    const newer = fixtureResult();
    startImportMock.mockResolvedValue(newer);

    const restoring = restoreDataStore();
    await importFiles(files);
    load(saved);

    expect(await restoring).toBe(false);
    expect(getDataState().result).toBe(newer);
  });

  it("a cancelled import keeps the data from before and saves nothing", async () => {
    const before = fixtureResult();
    startImportMock.mockResolvedValueOnce(before);
    await importFiles(files);
    saveDataMock.mockClear();

    let finish: (result: ImportResult) => void = () => {};
    startImportMock.mockReturnValue(
      new Promise((resolve) => (finish = resolve)),
    );
    const running = importFiles(files);
    cancelDataImport();
    expect(getDataState()).toMatchObject({ status: "ready", result: before });

    finish(fixtureResult());
    await running;
    expect(getDataState().result).toBe(before);
    expect(saveDataMock).not.toHaveBeenCalled();
  });
});
