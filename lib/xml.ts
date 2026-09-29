import { XMLParser, XMLValidator } from "fast-xml-parser";

export type XmlDoc = Record<string, unknown>;

// these tags can show up more than once, so we always want an array
// (otherwise a single <Observation> would be an object instead of a list)
const ARRAY_TAGS = ["Observation", "Meter", "TimePeriod", "ValueRow"];

const parser = new XMLParser({
  ignoreAttributes: false, // esl stores its data in attributes (obis, value, end)
  attributeNamePrefix: "",
  ignoreDeclaration: true, // skip the <?xml ...?> line
  removeNSPrefix: true, // "rsm:Observation" becomes "Observation"
  parseTagValue: false, // keep everything as text, we convert numbers ourselves
  isArray: (tagName) => ARRAY_TAGS.includes(tagName),
});

// turns xml text into a js object, or returns an error message if the xml is broken
export function parseXml(
  xml: string,
): { ok: true; doc: XmlDoc } | { ok: false; message: string } {
  // the parser alone doesn't always complain about broken xml, so check first
  const check = XMLValidator.validate(xml);
  if (check !== true) {
    return {
      ok: false,
      message: `Invalid XML: ${check.err.msg} (line ${check.err.line})`,
    };
  }

  const doc = parser.parse(xml) as XmlDoc;
  return { ok: true, doc };
}

// name of the outermost tag, e.g. "ValidatedMeteredData_14" or "ESLBillingData"
export function rootName(doc: XmlDoc): string | undefined {
  return Object.keys(doc)[0];
}
