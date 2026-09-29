// adding up floats gives things like 19216.199999, so we round to 4 decimals
export function roundKwh(n: number): number {
  return Math.round(n * 10000) / 10000;
}
