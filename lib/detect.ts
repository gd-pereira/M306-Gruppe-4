import { parseXml, rootName } from "@/lib/xml";

export type FileType = "sdat" | "esl";

// sdat files come in versions _12 to _15, so we only check the start
export const SDAT_ROOT_PREFIX = "ValidatedMeteredData_";
export const ESL_ROOT = "ESLBillingData";

// looks at the outermost tag to tell sdat and esl apart
// returns null for broken xml or anything else
export function detectFileType(xml: string): FileType | null {
  const result = parseXml(xml);
  if (!result.ok) {
    return null;
  }

  const root = rootName(result.doc) ?? "";

  if (root.startsWith(SDAT_ROOT_PREFIX)) {
    return "sdat";
  }
  if (root === ESL_ROOT) {
    return "esl";
  }
  return null;
}
