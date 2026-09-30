// swiss grouping with ’ (U+2019), built by hand because Intl output differs between node and browsers and breaks hydration
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer, fraction] = fixed.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  const negative = value < 0 && Number(fixed) !== 0;
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}
