const zurichOffsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Zurich",
  timeZoneName: "longOffset",
});

// offset of swiss time to UTC at that moment in seconds, 3600 in winter and 7200 in summer
function zurichOffset(date: Date): number {
  // the part looks like "GMT+01:00"
  const zoneName = zurichOffsetFormat
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /([+-])(\d{2}):(\d{2})/.exec(zoneName ?? "");
  if (!match) return 3600;
  const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60;
  return match[1] === "-" ? -seconds : seconds;
}

// turns a time without time zone (like "2019-03-01T00:00:00") into unix seconds,
// reading it as swiss local time. returns NaN for invalid input
export function zurichToUnix(localTime: string): number {
  const asUtc = Date.parse(`${localTime}Z`);
  if (Number.isNaN(asUtc)) {
    return NaN;
  }
  const local = asUtc / 1000;

  // the offset has to be read at the real moment, not at the local time read as UTC:
  // on the days the clocks change these differ for 01:00–02:00 local time
  const guess = local - zurichOffset(new Date(asUtc));
  return local - zurichOffset(new Date(guess * 1000));
}
