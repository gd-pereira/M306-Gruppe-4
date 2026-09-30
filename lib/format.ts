// swiss grouping with ’ (U+2019), built by hand because Intl output differs between node and browsers and breaks hydration
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

const zurichDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// dd.mm.yyyy of the day in zurich, ts in unix seconds
// assembled from the parts, the separator of the de-CH format is not the same everywhere
export function formatDate(ts: number): string {
  const parts = zurichDate.formatToParts(ts * 1000);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}.${part("year")}`;
}
