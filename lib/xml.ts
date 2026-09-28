import { XMLParser, XMLValidator } from "fast-xml-parser";

export type XmlDoc = Record<string, unknown>;

// Elemente, die mehrfach vorkommen können, sind immer ein Array
const ARRAY_TAGS = new Set(["Observation", "TimePeriod", "ValueRow"]);

const parser = new XMLParser({
  ignoreAttributes: false, // ESL braucht Attribute (obis, value, end)
  attributeNamePrefix: "",
  ignoreDeclaration: true,
  removeNSPrefix: true, // "rsm:Observation" -> "Observation"
  parseTagValue: false, // alles als String, Zahlen werden selbst umgewandelt
  isArray: (name, _jpath, _isLeaf, isAttribute) =>
    !isAttribute && ARRAY_TAGS.has(name),
});

export function parseXml(
  xml: string,
): { ok: true; doc: XmlDoc } | { ok: false; meldung: string } {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    return {
      ok: false,
      meldung: `Ungültiges XML: ${valid.err.msg} (Zeile ${valid.err.line})`,
    };
  }
  return { ok: true, doc: parser.parse(xml) as XmlDoc };
}

/** Name des obersten Elements, z.B. "ValidatedMeteredData_14" */
export function rootName(doc: XmlDoc): string | undefined {
  return Object.keys(doc)[0];
}
