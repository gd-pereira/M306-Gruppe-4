export type Point = { date: Date; consumption: number; feedIn: number };

// generates 15 min values: solar feed-in during the day, consumption at night
export function generateFakeData(days = 30): Point[] {
  const start = Date.UTC(2024, 5, 1); // 1 june 2024
  const points: Point[] = [];
  for (let i = 0; i < days * 96; i++) {
    const date = new Date(start + i * 15 * 60 * 1000);
    const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
    const sun = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    const feedIn = +(sun * 1.2 * (0.7 + Math.random() * 0.3)).toFixed(3);
    const consumption = +(0.1 + (1 - sun) * 0.3 + Math.random() * 0.1).toFixed(
      3,
    );
    points.push({ date, consumption, feedIn });
  }
  return points;
}

// sums up the values per bucket, e.g. 60 = hour, 1440 = day
export function aggregateByMinutes(points: Point[], minutes: number): Point[] {
  const ms = minutes * 60 * 1000;
  const buckets = new Map<number, Point>();
  for (const p of points) {
    const key = Math.floor(p.date.getTime() / ms) * ms;
    const bucket = buckets.get(key) ?? {
      date: new Date(key),
      consumption: 0,
      feedIn: 0,
    };
    bucket.consumption += p.consumption;
    bucket.feedIn += p.feedIn;
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}
