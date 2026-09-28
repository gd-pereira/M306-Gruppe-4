export type Punkt = { date: Date; bezug: number; einspeisung: number };

// Erzeugt Viertelstunden-Werte: tagsüber Solar-Einspeisung, nachts Bezug
export function erzeugeFakeDaten(tage = 30): Punkt[] {
  const start = Date.UTC(2024, 5, 1); // 1. Juni 2024
  const punkte: Punkt[] = [];
  for (let i = 0; i < tage * 96; i++) {
    const date = new Date(start + i * 15 * 60 * 1000);
    const stunde = date.getUTCHours() + date.getUTCMinutes() / 60;
    const sonne = Math.max(0, Math.sin(((stunde - 6) / 12) * Math.PI));
    const einspeisung = +(sonne * 1.2 * (0.7 + Math.random() * 0.3)).toFixed(3);
    const bezug = +(0.1 + (1 - sonne) * 0.3 + Math.random() * 0.1).toFixed(3);
    punkte.push({ date, bezug, einspeisung });
  }
  return punkte;
}

// Fasst Werte zusammen (Summe pro Abschnitt), z. B. 60 = Stunde, 1440 = Tag
export function zusammenfassen(punkte: Punkt[], minuten: number): Punkt[] {
  const ms = minuten * 60 * 1000;
  const gruppen = new Map<number, Punkt>();
  for (const p of punkte) {
    const key = Math.floor(p.date.getTime() / ms) * ms;
    const g = gruppen.get(key) ?? { date: new Date(key), bezug: 0, einspeisung: 0 };
    g.bezug += p.bezug;
    g.einspeisung += p.einspeisung;
    gruppen.set(key, g);
  }
  return [...gruppen.values()];
}
