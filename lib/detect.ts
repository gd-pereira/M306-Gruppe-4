import { parseXml, rootName } from "@/lib/xml";

export type Dateityp = "sdat" | "esl";

export const SDAT_ROOT_PREFIX = "ValidatedMeteredData_";
export const ESL_ROOT = "ESLBillingData";

/** Erkennt den Dateityp am obersten XML-Element. Kaputtes oder unbekanntes XML ergibt null. */
export function detectDateityp(xml: string): Dateityp | null {
  const result = parseXml(xml);
  if (!result.ok) return null;

  const root = rootName(result.doc);
  if (root?.startsWith(SDAT_ROOT_PREFIX)) return "sdat";
  if (root === ESL_ROOT) return "esl";
  return null;
}
