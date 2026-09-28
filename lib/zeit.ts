// gives the offset of swiss time to UTC at that moment,
// "+01:00" in winter and "+02:00" in summer
function zurichOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich",
    timeZoneName: "longOffset",
  }).formatToParts(date);

  // the part looks like "GMT+01:00"
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value;
  return (zoneName ?? "GMT+01:00").replace("GMT", "");
}

// turns a time without time zone (like "2019-03-01T00:00:00") into unix seconds,
// reading it as swiss local time. returns NaN for invalid input
export function zurichZuUnix(localTime: string): number {
  const date = new Date(`${localTime}Z`);
  if (Number.isNaN(date.getTime())) {
    return NaN;
  }

  // "2019-03-01T00:00:00" + "+01:00" -> 2019-02-28T23:00:00Z
  const offset = zurichOffset(date);
  return Date.parse(`${localTime}${offset}`) / 1000;
}
