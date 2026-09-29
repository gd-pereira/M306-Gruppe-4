import { SDAT_ROOT_PREFIX } from "@/lib/detect";
import { INTERVAL } from "@/lib/timeseries";
import { SENSOR_IDS } from "@/lib/types";
import type {
  DataPoint,
  Direction,
  FileError,
  IgnoredFile,
  Series,
} from "@/lib/types";
import { parseXml, rootName } from "@/lib/xml";

// ignored is not an error, the import page lists those files separately
// placeholders = how many condition 21 values were skipped, the import page shows the total
export type SdatResult =
  | { ok: true; series: Series; placeholders: number }
  | { ok: false; error: FileError }
  | { ok: false; ignored: IgnoredFile };

// only the parts of the sdat file we actually read
interface SdatRoot {
  ValidatedMeteredData_HeaderInformation?: {
    InstanceDocument?: { DocumentID?: string; Creation?: string };
  };
  MeteringData?: {
    Interval?: { StartDateTime?: string };
    Resolution?: { Resolution?: string; Unit?: string };
    ConsumptionMeteringPoint?: unknown;
    ProductionMeteringPoint?: unknown;
    Observation?: {
      Position?: { Sequence?: string };
      Volume?: string;
      Condition?: string;
    }[];
  };
}

// condition 21 = placeholder 0, the real value comes later in a newer file
// the client said to always take the real value, so we skip these
const PLACEHOLDER_CONDITION = "21";

const WANTED_SENSORS: readonly string[] = Object.values(SENSOR_IDS);

function fail(file: string, message: string): SdatResult {
  return { ok: false, error: { file, message } };
}

// reads one sdat file into a series of 15 min usage values
// never throws, problems end up in the error list instead
export function parseSdat(xml: string, file: string): SdatResult {
  const result = parseXml(xml);
  if (!result.ok) {
    return fail(file, result.message);
  }

  const rootKey = rootName(result.doc) ?? "";
  if (!rootKey.startsWith(SDAT_ROOT_PREFIX)) {
    return fail(file, "Not an SDAT file");
  }
  const root = result.doc[rootKey] as SdatRoot;

  // DocumentID looks like "eslevu121963_BR2294_ID742", we want the "ID742" at the end
  const documentId =
    root.ValidatedMeteredData_HeaderInformation?.InstanceDocument?.DocumentID ??
    "";
  const match = documentId.match(/_(ID\d+)$/);
  if (!match) {
    return fail(file, "Sensor ID missing in DocumentID");
  }
  const sensorId = match[1];

  // e.g. ID26256 from 2023 on, the client said to ignore all sensors except these two
  if (!WANTED_SENSORS.includes(sensorId)) {
    return { ok: false, ignored: { file, sensorId } };
  }

  const data = root.MeteringData;
  if (!data) {
    return fail(file, "MeteringData missing");
  }

  // the direction comes from the tag name, not from the sensor id
  let direction: Direction;
  if (data.ConsumptionMeteringPoint !== undefined) {
    direction = "consumption";
  } else if (data.ProductionMeteringPoint !== undefined) {
    direction = "feedIn";
  } else {
    return fail(
      file,
      "Neither ConsumptionMeteringPoint nor ProductionMeteringPoint",
    );
  }

  // we only handle 15 min values
  const resolution = data.Resolution;
  if (resolution?.Resolution !== "15" || resolution?.Unit !== "MIN") {
    return fail(file, "Resolution is not 15 minutes");
  }

  // start time is in UTC ("...Z"), Date.parse gives milliseconds
  const start = Date.parse(data.Interval?.StartDateTime ?? "") / 1000;
  if (Number.isNaN(start)) {
    return fail(file, "Invalid StartDateTime");
  }

  const observations = data.Observation ?? [];
  if (observations.length === 0) {
    return fail(file, "No observations");
  }

  const points: DataPoint[] = [];
  let placeholders = 0;
  for (const observation of observations) {
    const sequence = Number(observation.Position?.Sequence);
    const value = Number(observation.Volume);

    if (!Number.isInteger(sequence) || sequence < 1 || Number.isNaN(value)) {
      return fail(file, `Invalid observation (sequence ${sequence})`);
    }

    if (observation.Condition === PLACEHOLDER_CONDITION) {
      placeholders++;
      continue;
    }

    // sequence starts at 1, so the first value is exactly at the start time
    const ts = start + (sequence - 1) * INTERVAL;
    points.push({ ts, value });
  }

  // a file with only placeholders is fine, it just adds no values
  points.sort((a, b) => a.ts - b.ts);

  // missing creation date counts as oldest, so any other file wins
  const creation = Date.parse(
    root.ValidatedMeteredData_HeaderInformation?.InstanceDocument?.Creation ??
      "",
  );
  const createdAt = Number.isNaN(creation) ? 0 : creation / 1000;

  return {
    ok: true,
    series: { sensorId, direction, kind: "usage", points, createdAt },
    placeholders,
  };
}
