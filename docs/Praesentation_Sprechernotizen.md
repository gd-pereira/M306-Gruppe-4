# Flux — Präsentations-Leitfaden & Sprechernotizen

**Modul 306 «IT-Kleinprojekt abwickeln» · BZZ Projektwoche 2026**  
**Gruppe 4:** Lasse Nothelfer, Ennio Vögeli, Gonçalo Pereira, Paul Kühn, Elias Hüngerle  
**Auftraggeber:** Roger Bünzli, Energieagentur Bünzli  
**Gesamtbudget:** Exakt 15 Minuten (Kriterium 2.8: $\pm 1$ Min für volle Punktzahl!)  
**Figma-Präsentation:** Seite `Präsentation` im Mockups-File (1920×1080, 16:9 Widescreen)

---

## Zeit- und Rollenübersicht

| Folie | Thema | Sprecher | Dauer | Zeitfenster (kumulativ) |
| :---: | :--- | :--- | :---: | :---: |
| **01** | Titel & Begrüssung | Lasse Nothelfer (PL) | 0:30 | 00:00 – 00:30 |
| **02** | Agenda & Roter Faden | Lasse Nothelfer (PL) | 0:30 | 00:30 – 01:00 |
| **03** | Ausgangslage & Auftrag | Ennio Vögeli | 1:00 | 01:00 – 02:00 |
| **04** | Team, Rollen & IPERKA | Lasse Nothelfer (PL) | 1:00 | 02:00 – 03:00 |
| **05** | Technologie & Datenschutz | Gonçalo Pereira | 0:45 | 03:00 – 03:45 |
| **06** | Die Rohdaten: sdat vs. ESL | Elias Hüngerle | 0:45 | 03:45 – 04:30 |
| **07** | Verarbeitungs-Pipeline | Paul Kühn (Lead Dev) | 1:00 | 04:30 – 05:30 |
| **08** | Die 3 Daten-Rätsel & Lösungen | Elias & Paul | 1:15 | 05:30 – 06:45 |
| **09** | Entscheide mit dem Auftraggeber | Lasse Nothelfer (PL) | 0:45 | 06:45 – 07:30 |
| **10** | **Live-Demo: Flux in Aktion** | **Paul & Elias** | **4:45** | **07:30 – 12:15** |
| **11** | Qualitätssicherung & Tests | Gonçalo Pereira | 1:00 | 12:15 – 13:15 |
| **12** | Soll-Ist-Vergleich | Ennio Vögeli | 0:45 | 13:15 – 14:00 |
| **13** | Team-Reflexion & Lessons Learned | Alle / Gonçalo | 0:30 | 14:00 – 14:30 |
| **14** | Ausblick & Weiterentwicklung | Paul Kühn | 0:15 | 14:30 – 14:45 |
| **15** | Abschluss, Dank & Fragerunde | Lasse Nothelfer | 0:15 | 14:45 – 15:00 |
| **—** | **Fachgespräch mit Lehrpersonen** | **Ganzes Team** | **5:00** | **15:00 – 20:00** |

---

## Detaillierte Folien-Notizen

### Folie 01: Titel & Begrüssung
* **Sprecher:** Lasse Nothelfer (PL)
* **Zielzeit:** `0:30 min` (bis `00:30`)
* **Kriterium 2.2 (Begrüssung):**
  > «Guten Tag geschätzte Lehrpersonen, geschätzte Mitschülerinnen und Mitschüler. Wir freuen uns, Ihnen heute unser Projekt **Flux** im Rahmen des Moduls 306 vorzustellen.»
* **Inhalt:**
  - Thema kurz nennen: Flux ist eine moderne Web-Plattform zur intelligenten Analyse und Visualisierung von Schweizer Smart-Meter-Daten (sdat und ESL) für die Energieagentur Bünzli.
  - Hinweis auf das Zeitbudget: 15 Minuten Präsentation (inklusive 5 Minuten Live-Demo), gefolgt von einem 5-minütigen Fachgespräch.

---

### Folie 02: Agenda & Roter Faden
* **Sprecher:** Lasse Nothelfer (PL)
* **Zielzeit:** `0:30 min` (bis `01:00`)
* **Kriterium 2.5 (Roter Faden):**
  > «Unser Vortrag folgt einem klaren roten Faden entlang des IPERKA-Modells: Von der Ausgangslage und dem Chaos aus über 5'000 XML-Dateien über unsere Architektur und die mathematischen Daten-Rätsel bis zur Live-Demo und unserem Qualitätsbericht.»
* **Übergabe:** «Ennio startet nun mit der Ausgangslage.»

---

### Folie 03: Ausgangslage & Auftrag
* **Sprecher:** Ennio Vögeli
* **Zielzeit:** `1:00 min` (bis `02:00`)
* **Stichpunkte:**
  - **Der Auftraggeber:** Roger Bünzli von der Energieagentur Bünzli berät Kunden bezüglich Solaranlagen und Energieeffizienz.
  - **Das Dilemma (Schmerzpunkt):** Er erhält von den Elektrizitätswerken gigantische Datenmengen — konkret **5'180 kryptische XML-Dateien**. Eine manuelle Auswertung ist unmöglich.
  - **Kernproblem:** Die sdat-Dateien enthalten nur 15-Minuten-Verbrauchswerte ohne absoluten Zählerstand; die ESL-Dateien enthalten nur seltene Monats-Zählerstände.
  - **Die Mission:** Flux soll beide Formate automatisiert verschmelzen, lückenlose Zählerstände berechnen, interaktiv visualisieren und exportieren.

---

### Folie 04: Team, Rollen & IPERKA-Vorgehen
* **Sprecher:** Lasse Nothelfer (PL)
* **Zielzeit:** `1:00 min` (bis `03:00`)
* **Kriterien 6.2 (Rollenverteilung) & 3.4 (Planung):**
  - **Rollen:**
    - Lasse (Projektleitung & externe Schnittstelle)
    - Ennio (Dokumentation & Qualitätskontrolle)
    - Gonçalo (Präsentationsgestaltung & UI-Testing)
    - Paul (Entwicklungsleiter & Pipeline-Architektur)
    - Elias (Datenlogik & Parsing-Mathematik)
  - **Trello & IPERKA:**
    - Aufgaben strikt nach 5 Projekttagen strukturiert (`T1-1` bis `T5-X`).
    - Sequenzielles IPERKA-Modell gewählt, da Anforderungen und Termine fest vorgegeben waren.
* **Übergabe:** «Gonçalo stellt nun unsere Architektur vor.»

---

### Folie 05: Technologie: «Datenschutz by Design»
* **Sprecher:** Gonçalo Pereira
* **Zielzeit:** `0:45 min` (bis `03:45`)
* **Kriterium 4.1 & 4.2 (Nutzwertanalyse & Standards):**
  - **Stack:** Next.js 16.3, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui und Visx/Motion.
  - **Architektur-Entscheid (Gamechanger):** 
    - **100% Client-Side In-Browser Execution.**
    - Warum? Verbrauchsdaten sind hochsensibel (Rückschlüsse auf Anwesenheiten). Bei Flux verlässt kein einziges Byte den Browser!
    - Null Serverkosten, kein Upload-Verzug, vollständige DSGVO/nDSG-Konformität.
* **Übergabe:** «Elias zeigt nun, wie sich die beiden Datenformate unterscheiden.»

---

### Folie 06: Die Rohdaten: sdat vs. ESL
* **Sprecher:** Elias Hüngerle
* **Zielzeit:** `0:45 min` (bis `04:30`)
* **Fachliche Differenzierung:**
  - **sdat (5'133 Files):** Viertelstunden-Auflösung, rein relative Verbrauchsmengen (kWh), UTC. Wichtig sind nur Sensor ID742 (Netzbezug) und ID735 (Solareinspeisung).
  - **ESL (47 Files):** Seltene Monatsstände, absolute Zählerstände in Schweizer Lokalzeit. Hoch- und Niedertarif (`1.8.1 + 1.8.2`) müssen summiert werden.
  - **Kernaussage:** Erst sdat (Granularität) plus ESL (Nullpunkt) ergeben den wahren Zählerstand.

---

### Folie 07: Die Verarbeitungs-Pipeline
* **Sprecher:** Paul Kühn (Lead Dev)
* **Zielzeit:** `1:00 min` (bis `05:30`)
* **7 Stufen Schritt für Schritt:**
  1. Drag & Drop von 5'180 Dateien.
  2. Web Worker: Threading im Hintergrund hält die Seite reaktiv (Fortschrittsmeldung alle 50 Files).
  3. Zero-Crash Parser: Eine beschädigte XML wirft keinen Fehler, sondern landet im Status-Log.
  4. Deduplizierung: Neuestes Erstelldatum gewinnt bei Überlappungen.
  5. Zählerstände vorwärts & rückwärts addieren/subtrahieren.
  6. Konsistenzprüfung & Lückenerkennung.
  7. Zoomstufen (15m, 1h, 1d, 1w, 1m) werden einmalig im RAM vorberechnet.

---

### Folie 08: Die 3 grossen Daten-Rätsel & Lösungen
* **Sprecher:** Elias Hüngerle & Paul Kühn
* **Zielzeit:** `1:15 min` (bis `06:45`)
* **Ingenieursmässiges Problemlösen (Kriterium 6.6):**
  - **Rätsel 1 (Zeitzonen):** ESL hat kein 'Z' oder Offset. Konvertierung von Europe/Zurich nach UTC, inkl. Behandlung der Zeitumstellungstage (92 bzw. 100 Messwerte).
  - **Rätsel 2 (Der Faktor 3):** sdat-Summen sind exakt 3.00× der ESL-Zuwachs. Ein unskaliertes Aufsummieren hätte 2018 zu absurden negativen Ständen (−28'000 kWh) geführt. Durch `fitMeterReadings` startet 2018 sauber positiv (3'569.9 kWh Bezug).
  - **Rätsel 3 (Condition 21):** 128'888 vorläufige 0-Platzhalter wurden gefiltert, da die echten Werte in späteren Dateien nachgeliefert werden.

---

### Folie 09: Entscheide mit dem Auftraggeber
* **Sprecher:** Lasse Nothelfer (PL)
* **Zielzeit:** `0:45 min` (bis `07:30`)
* **Absprachen mit Roger Bünzli:**
  - Irrelevante Sensoren (z.B. ID26256 oder Wasserzähler) gezielt als «ignoriert» einstufen.
  - Lücken transparent rot markieren statt Werte künstlich zu interpolieren.
  - Nahtlose Fortführung: Ab 09.2021, wo sdat aufhört, weiterhin ESL-Punkte anzeigen.
* **Übergabe:** «Jetzt zeigen Paul und Elias das System live in Aktion!»

---

### Folie 10: Live-Demo: Flux in Aktion
* **Sprecher:** Paul Kühn & Elias Hüngerle (einer klickt, einer spricht)
* **Zielzeit:** `4:45 min` (bis `12:15` — **ACHTUNG: Kriterium 2.8: Max. 5 Minuten!**)
* **Demo-Ablauf:**
  1. **Import (ca. 1 Min):** Dateien per Drag & Drop reinziehen, Web-Worker-Fortschrittsbalken zeigen, Dateitabelle erläutern (Deduplizierung & ignorierte Files).
  2. **Dashboard (ca. 1 Min):** Kennzahlen präsentieren: Solarquote, Einspeisung vs. Bezug, Monats-Tooltips.
  3. **Verbrauch & Zählerstand (ca. 1.5 Min):** Stufenloses Zoomen demonstrieren: Von der Jahresansicht 2020 über Tage bis zu einzelnen 15-Minuten-Balken. ESL-Vergleichspunkte und Lücken zeigen.
  4. **Export (ca. 1 Min):** CSV- und JSON-Dateien herunterladen, Formatierung (UTC Timestamp + Wert) im Editor kurz zeigen.

---

### Folie 11: Qualitätssicherung & Testresultate
* **Sprecher:** Gonçalo Pereira
* **Zielzeit:** `1:00 min` (bis `13:15`)
* **Hard Facts (Kriterium 4.3):**
  - **179 Unit- & Integrationstests in 16 Suiten — alle 100% grün!**
  - ~44 Sekunden Importzeit für den Gesamtdatensatz (5'180 Dateien).
  - 31'644 Duplikate und 128'888 Platzhalter fehlerfrei bereinigt.
  - 128'060 berechnete Datenpunkte pro Richtung.
  - 4 Lücken (11 fehlende Tage) mathematisch präzise aufgespürt.

---

### Folie 12: Soll-Ist-Vergleich (Auftragserfüllung)
* **Sprecher:** Ennio Vögeli
* **Zielzeit:** `0:45 min` (bis `14:00`)
* **Pflichtenheft-Abgleich:**
  - Alle 6 Muss-Kriterien zu 100% erfüllt und durch automatisierte Tests verifiziert.
  - Wunschkriterium JSON-Export vollständig umgesetzt.
  - Wunschkriterium HTTP POST Upload architektonisch implementiert und vorbereitet.

---

### Folie 13: Team-Reflexion & Lessons Learned
* **Sprecher:** Alle / Gonçalo Pereira
* **Zielzeit:** `0:30 min` (bis `14:30`)
* **Reflexion (Kriterium 5.3):**
  - **Top:** Klare Rollen und Aufgaben nach Stärken, Test-Driven-Pipeline sparte Tage.
  - **Herausforderung:** Realdaten sind voller Tücken (Faktor 3, Zeitzonen), DOM-Performance bei riesigen Datenmengen.
  - **Erkenntnis:** Gründliche Datenanalyse vor dem Coden ist das A und O.

---

### Folie 14: Ausblick & Weiterentwicklung
* **Sprecher:** Paul Kühn
* **Zielzeit:** `0:15 min` (bis `14:45`)
* **Zukunftsvision:**
  - Lokale IndexedDB-Persistenz (kein Neu-Import nach Browser-Neustart).
  - Prognosemodelle für Photovoltaik-Ertrag.
  - Direkte B2B-Schnittstelle zu Schweizer Stromnetzbetreibern.

---

### Folie 15: Abschluss, Dank & Fragerunde
* **Sprecher:** Lasse Nothelfer (PL)
* **Zielzeit:** `0:15 min` (bis `15:00` — **Punktlandung!**)
* **Kriterium 2.2 (Verabschiedung):**
  > «Wir danken Roger Bünzli für den spannenden Projektauftrag und Ihnen für Ihre geschätzte Aufmerksamkeit. Wir stehen Ihnen nun sehr gerne für Ihre Fragen und das Fachgespräch zur Verfügung.»
