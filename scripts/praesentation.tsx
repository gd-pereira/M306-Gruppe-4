// Finale Projektpräsentation als PowerPoint (npm run slides -> praesentation.pptx).
// Inhalte stammen aus docs/Projektdokumentation_3_.docx und dem Code, Bilder aus public/praesentation/
// (Screenshots: npx tsx scripts/screenshots.ts). Fehlende Angaben sind als «[TODO: …]» markiert.
/* eslint-disable jsx-a11y/alt-text -- Image aus react-pptx ist kein HTML-Bild und kennt kein alt */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { Fragment, type ReactNode } from "react";
import {
  Image,
  Line,
  Presentation,
  Shape,
  Slide,
  Text,
  render,
} from "react-pptx";

const ROOT = path.resolve(__dirname, "..");
const BILDER = path.join(ROOT, "public", "praesentation");
const AUSGABE =
  process.env.PPTX_AUSGABE ?? path.join(ROOT, "praesentation.pptx");

// 16:9, 10 × 5.625 Zoll
const FARBE = {
  gelb: "#FDB51A",
  dunkel: "#13161A",
  grau: "#595959",
  hell: "#8A8A8A",
  linie: "#E4E4E4",
  flaeche: "#F6F6F4",
  todo: "#C2410C",
  weiss: "#FFFFFF",
  schwarz: "#0B0C0E",
  silber: "#C9C9C9",
};
const SCHRIFT = "Segoe UI";
const SCHRIFT_FETT = "Segoe UI Semibold";
const RAND = 0.6;
const BREITE = 10 - 2 * RAND;
const OBEN = 1.62;
const UNTEN = 4.98;

// Teile der Agenda, erscheinen als Leiste in der Fusszeile
const TEILE = [
  "Auftrag & Team",
  "Planung",
  "Umsetzung & Demo",
  "Kontrolle",
  "Auswertung",
];
type Teil = 0 | 1 | 2 | 3 | 4 | null;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------- Hilfen ----------

function bild(name: string) {
  const file = path.join(BILDER, name);
  if (!fs.existsSync(file))
    throw new Error(
      `Bild fehlt: ${file} (zuerst scripts/screenshots.ts ausführen)`,
    );
  const buffer = fs.readFileSync(file);
  // PNG: Breite und Höhe stehen im IHDR-Block ab Byte 16
  const breite = buffer.readUInt32BE(16);
  const hoehe = buffer.readUInt32BE(20);
  return {
    data: `image/png;base64,${buffer.toString("base64")}`,
    verhaeltnis: breite / hoehe,
  };
}

// Bild ohne Verzerrung in die Box einpassen
function einpassen(
  verhaeltnis: number,
  box: Box,
  ausrichtung: "mitte" | "links" | "oben" = "mitte",
): Box {
  let w = box.w;
  let h = w / verhaeltnis;
  if (h > box.h) {
    h = box.h;
    w = h * verhaeltnis;
  }
  const x = ausrichtung === "links" ? box.x : box.x + (box.w - w) / 2;
  const y = ausrichtung === "oben" ? box.y : box.y + (box.h - h) / 2;
  return { x, y, w, h };
}

const isTodo = (text: string) => text.startsWith("[TODO");

// ---------- Bausteine ----------

function Rechteck({
  box,
  farbe,
  rand,
}: {
  box: Box;
  farbe: string;
  rand?: string;
}) {
  return (
    <Shape
      type="rect"
      style={{
        ...box,
        backgroundColor: farbe,
        borderColor: rand ?? farbe,
        borderWidth: rand ? 0.75 : 0,
      }}
    />
  );
}

function Kopf({ titel, untertitel }: { titel: string; untertitel?: string }) {
  return (
    <>
      <Text
        style={{
          x: RAND,
          y: 0.4,
          w: BREITE,
          h: 0.66,
          fontSize: 26,
          fontFace: SCHRIFT_FETT,
          color: FARBE.dunkel,
          verticalAlign: "bottom",
          margin: 0,
        }}
      >
        {titel}
      </Text>
      {untertitel ? (
        <Text
          style={{
            x: RAND,
            y: 1.1,
            w: BREITE,
            h: 0.32,
            fontSize: 12,
            fontFace: SCHRIFT,
            color: FARBE.hell,
            margin: 0,
          }}
        >
          {untertitel}
        </Text>
      ) : null}
    </>
  );
}

// Teil der Agenda links, Foliennummer rechts
function Fuss({ nr, teil }: { nr: number; teil: Teil }) {
  const stil = {
    y: 5.15,
    h: 0.24,
    fontSize: 9,
    fontFace: SCHRIFT,
    color: FARBE.hell,
    margin: 0,
  };
  return (
    <>
      {teil === null ? null : (
        <Text style={{ ...stil, x: RAND, w: 3 }}>{TEILE[teil]}</Text>
      )}
      <Text style={{ ...stil, x: 8.9, w: 0.5, align: "right" }}>
        {String(nr)}
      </Text>
    </>
  );
}

function Punkte({
  items,
  box,
  groesse = 15,
}: {
  items: string[];
  box: Box;
  groesse?: number;
}) {
  return (
    <Text
      style={{
        ...box,
        fontSize: groesse,
        fontFace: SCHRIFT,
        color: FARBE.dunkel,
        verticalAlign: "top",
        margin: 0,
      }}
    >
      {items.map((item) => (
        // react-pptx kennt keine Absätze ohne Aufzählung, das Zeichen ohne Breite bleibt unsichtbar
        <Text.Bullet
          key={item}
          characterCode="200B"
          indent={1}
          style={{
            color: isTodo(item) ? FARBE.todo : FARBE.dunkel,
            italic: isTodo(item),
            paraSpaceAfter: 12,
          }}
        >
          {item}
        </Text.Bullet>
      ))}
    </Text>
  );
}

function Absatz({
  text,
  box,
  groesse = 13,
  farbe = FARBE.grau,
  fett = false,
  ausrichtung = "left",
}: {
  text: string;
  box: Box;
  groesse?: number;
  farbe?: string;
  fett?: boolean;
  ausrichtung?: "left" | "center" | "right";
}) {
  return (
    <Text
      style={{
        ...box,
        fontSize: groesse,
        fontFace: fett ? SCHRIFT_FETT : SCHRIFT,
        color: isTodo(text) ? FARBE.todo : farbe,
        italic: isTodo(text),
        align: ausrichtung,
        verticalAlign: "top",
        margin: 0,
      }}
    >
      {text}
    </Text>
  );
}

function Trenner({ y }: { y: number }) {
  return (
    <Line
      x1={RAND}
      x2={RAND + BREITE}
      y1={y}
      y2={y}
      style={{ color: FARBE.linie, width: 0.75 }}
    />
  );
}

// Bild mit feinem Rahmen, ohne Verzerrung
function Bild({
  name,
  box,
  ausrichtung,
}: {
  name: string;
  box: Box;
  ausrichtung?: "mitte" | "links" | "oben";
}) {
  const { data, verhaeltnis } = bild(name);
  const passend = einpassen(verhaeltnis, box, ausrichtung);
  return (
    <>
      <Rechteck
        box={{
          x: passend.x - 0.01,
          y: passend.y - 0.01,
          w: passend.w + 0.02,
          h: passend.h + 0.02,
        }}
        farbe={FARBE.weiss}
        rand={FARBE.linie}
      />
      <Image src={{ kind: "data", data }} style={passend} />
    </>
  );
}

function Kennzahl({
  wert,
  label,
  x,
  y,
  w,
}: {
  wert: string;
  label: string;
  x: number;
  y: number;
  w: number;
}) {
  return (
    <>
      <Absatz
        text={wert}
        box={{ x, y, w, h: 0.6 }}
        groesse={30}
        farbe={FARBE.dunkel}
        fett
      />
      <Absatz text={label} box={{ x, y: y + 0.6, w, h: 0.5 }} groesse={11} />
    </>
  );
}

// ---------- Folientypen ----------

interface Basis {
  nr: number;
  teil: Teil;
  notes: string;
}

const TEAM_ZEILE =
  "Lasse Nothelfer · Ennio Vögeli · Gonçalo Pereira · Paul Kühn · Elias Hüngerle";

// Titel und Schluss auf dem Datenbild von scripts/cover.ts
function DunkleFolie({
  notes,
  titel,
  untertitel,
  fusszeile,
}: {
  notes: string;
  titel: string;
  untertitel: string;
  fusszeile: string;
}) {
  const cover = bild("cover.png");
  return (
    <Slide
      notes={notes}
      style={{
        backgroundColor: FARBE.schwarz,
        backgroundImage: { kind: "data", data: cover.data },
      }}
    >
      <>
        <Absatz
          text={titel}
          box={{ x: RAND, y: 0.38, w: 6, h: 0.95 }}
          groesse={60}
          farbe={FARBE.weiss}
          fett
        />
        <Absatz
          text={untertitel}
          box={{ x: RAND, y: 1.3, w: 6.5, h: 0.4 }}
          groesse={14}
          farbe={FARBE.silber}
        />
        <Absatz
          text={
            "Jede Linie ist eine Stunde Messdaten aus 2020\noben Einspeisung, unten Bezug"
          }
          box={{ x: 6.2, y: 0.5, w: 3.2, h: 0.5 }}
          groesse={9}
          farbe={FARBE.hell}
          ausrichtung="right"
        />
        <Absatz
          text={TEAM_ZEILE}
          box={{ x: RAND, y: 4.98, w: BREITE, h: 0.26 }}
          groesse={11}
          farbe={FARBE.silber}
        />
        <Absatz
          text={fusszeile}
          box={{ x: RAND, y: 5.24, w: BREITE, h: 0.24 }}
          groesse={8}
          farbe={FARBE.hell}
        />
      </>
    </Slide>
  );
}

function TitelFolie({ notes }: Omit<Basis, "teil">) {
  return (
    <DunkleFolie
      notes={notes}
      titel="Flux"
      untertitel="Software zur Visualisierung von sdat- und ESL-Zählerdaten"
      fusszeile="Projektpräsentation Modul 306 · Gruppe 4 · Auftraggeber: Energieagentur Bünzli, Roger Bünzli · KSH / IM24 · Lehrperson: André Probst · 02.10.2026"
    />
  );
}

function InhaltFolie({
  nr,
  teil,
  notes,
  titel,
  untertitel,
  punkte,
  breite = BREITE,
  children,
}: Basis & {
  titel: string;
  untertitel?: string;
  punkte?: string[];
  breite?: number;
  children?: ReactNode;
}) {
  return (
    <Slide notes={notes} style={{ backgroundColor: FARBE.weiss }}>
      <>
        <Kopf titel={titel} untertitel={untertitel} />
        {punkte ? (
          <Punkte
            items={punkte}
            box={{ x: RAND, y: OBEN, w: breite, h: UNTEN - OBEN }}
          />
        ) : null}
        {children}
        <Fuss nr={nr} teil={teil} />
      </>
    </Slide>
  );
}

function BildFolie({
  nr,
  teil,
  notes,
  titel,
  untertitel,
  name,
  punkte,
}: Basis & {
  titel: string;
  untertitel?: string;
  name: string;
  punkte?: string[];
}) {
  const mitText = !!punkte;
  const bildBox = mitText
    ? { x: RAND, y: OBEN, w: 6.1, h: UNTEN - OBEN }
    : { x: RAND, y: OBEN - 0.05, w: BREITE, h: UNTEN - OBEN + 0.1 };
  return (
    <Slide notes={notes} style={{ backgroundColor: FARBE.weiss }}>
      <>
        <Kopf titel={titel} untertitel={untertitel} />
        <Bild
          name={name}
          box={bildBox}
          ausrichtung={mitText ? "oben" : "mitte"}
        />
        {punkte ? (
          <Punkte
            items={punkte}
            box={{ x: 7.0, y: OBEN, w: 2.4, h: UNTEN - OBEN }}
            groesse={13}
          />
        ) : null}
        <Fuss nr={nr} teil={teil} />
      </>
    </Slide>
  );
}

interface Spalte {
  titel: string;
  punkte?: string[];
  bild?: string;
  text?: string;
}

function SpalteInhalt({ spalte, box }: { spalte: Spalte; box: Box }) {
  const kopf = 0.42;
  const inhalt = { x: box.x, y: box.y + kopf, w: box.w, h: box.h - kopf };
  // die Bildunterschrift steht direkt unter dem eingepassten Bild
  const bildBox = spalte.bild
    ? einpassen(
        bild(spalte.bild).verhaeltnis,
        { ...inhalt, h: spalte.text ? inhalt.h - 0.4 : inhalt.h },
        "oben",
      )
    : null;
  return (
    <>
      <Absatz
        text={spalte.titel}
        box={{ x: box.x, y: box.y, w: box.w, h: 0.32 }}
        groesse={14}
        farbe={FARBE.dunkel}
        fett
      />
      {spalte.bild && bildBox ? (
        <Bild name={spalte.bild} box={bildBox} />
      ) : null}
      {bildBox && spalte.text ? (
        <Absatz
          text={spalte.text}
          box={{ x: box.x, y: bildBox.y + bildBox.h + 0.1, w: box.w, h: 0.3 }}
          groesse={11}
        />
      ) : null}
      {spalte.punkte ? (
        <Punkte items={spalte.punkte} box={inhalt} groesse={14} />
      ) : null}
    </>
  );
}

function ZweiSpalten({
  nr,
  teil,
  notes,
  titel,
  untertitel,
  links,
  rechts,
  children,
}: Basis & {
  titel: string;
  untertitel?: string;
  links: Spalte;
  rechts: Spalte;
  children?: ReactNode;
}) {
  const abstand = 0.4;
  const w = (BREITE - abstand) / 2;
  return (
    <Slide notes={notes} style={{ backgroundColor: FARBE.weiss }}>
      <>
        <Kopf titel={titel} untertitel={untertitel} />
        <SpalteInhalt
          spalte={links}
          box={{ x: RAND, y: OBEN, w, h: UNTEN - OBEN }}
        />
        <SpalteInhalt
          spalte={rechts}
          box={{ x: RAND + w + abstand, y: OBEN, w, h: UNTEN - OBEN }}
        />
        {children}
        <Fuss nr={nr} teil={teil} />
      </>
    </Slide>
  );
}

function AbschlussFolie({ notes }: Omit<Basis, "teil">) {
  return (
    <DunkleFolie
      notes={notes}
      titel="Danke."
      untertitel="Wir freuen uns auf Ihre Fragen und das Fachgespräch."
      fusszeile="Quellen und Lizenzen der verwendeten Bibliotheken: Projektdokumentation, Kapitel 8"
    />
  );
}

// ---------- Folien ----------

// Name wie in der Fusszeile, dazu Inhalt und Startzeit
const agenda: [string, string, string][] = [
  ["Auftrag & Team", "Ausgangslage, Rollen, Vorgehen", "ab 0:50"],
  ["Planung", "Informieren, Planen, Entscheiden", "ab 2:30"],
  ["Umsetzung & Demo", "Realisieren, Live-Demo", "ab 5:20"],
  ["Kontrolle", "Tests, Soll-Ist, Abnahme", "ab 11:20"],
  ["Auswertung", "Reflexion, Fazit", "ab 12:50"],
];

const team: [string, string][] = [
  ["Lasse Nothelfer", "Projektleitung"],
  ["Ennio Vögeli", "Dokumentation"],
  ["Gonçalo Pereira", "Präsentation"],
  ["Paul Kühn", "Entwicklungsleiter"],
  ["Elias Hüngerle", "Entwickler"],
];

const nutzwert: [string, string, string, string][] = [
  ["Technologie-Stack", "Next.js", "4,10", "Java 3,70 · Python 2,80"],
  ["Diagramm-Bibliothek", "bklit", "3,80", "ECharts 3,75"],
  [
    "Datenhaltung",
    "keine Datenbank",
    "4,40",
    "IndexedDB 4,10 · Server-DB 1,85",
  ],
];

const pipeline = [
  "Dateien wählen",
  "Web Worker",
  "Parser sdat / ESL",
  "Duplikate & Lücken",
  "Zählerstände & Zoomstufen",
  "Data Store → Seiten",
];

const demo: [string, string][] = [
  ["Import und Zusammenfassung", "0:45"],
  ["Dashboard mit Kennzahlen und Hinweisen", "0:45"],
  ["Verbrauch: Jahr → Monat → Tag (Drill-down)", "1:15"],
  ["Zählerstand mit ESL-Ablesungen", "0:45"],
  ["Export als CSV und JSON", "0:45"],
];

const folien = [
  // Kriterium 2.2, 2.6: Begrüssung, Titelblatt
  (nr: number) => (
    <TitelFolie
      nr={nr}
      notes={
        "Lasse · 0:30 (bis 0:30)\n" +
        "Guten Tag, geschätzte Lehrpersonen und Mitschülerinnen und Mitschüler. Wir sind die Gruppe 4 und stellen Ihnen heute Flux vor, unsere Software zur Visualisierung von sdat- und ESL-Zählerdaten für die Energieagentur Bünzli. " +
        "Die Präsentation dauert 15 Minuten, darin enthalten ist eine Live-Demo von rund vier Minuten."
      }
    />
  ),

  // Kriterium 2.5, 2.6, 2.8: Agenda, roter Faden, Zeitplan
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={null}
      titel="Agenda"
      untertitel="Unser roter Faden ist das Vorgehensmodell IPERKA"
      notes={
        "Lasse · 0:20 (bis 0:50)\n" +
        "Wir folgen in der Präsentation den IPERKA-Phasen, genau wie im Projekt und in der Dokumentation. " +
        "Nach Auftrag und Team zeigen wir Planung und Entscheide, dann die Umsetzung mit Live-Demo und zum Schluss Tests und Reflexion. " +
        "Unten links auf jeder Folie steht, in welchem Teil wir gerade sind."
      }
    >
      {agenda.map(([name, inhalt, zeit], index) => {
        const y = OBEN + 0.05 + index * 0.62;
        return (
          <Fragment key={index}>
            <Absatz
              text={String(index + 1)}
              box={{ x: RAND, y, w: 0.5, h: 0.5 }}
              groesse={22}
              farbe={FARBE.gelb}
              fett
            />
            <Absatz
              text={name}
              box={{ x: RAND + 0.6, y: y + 0.04, w: 3, h: 0.45 }}
              groesse={18}
              farbe={FARBE.dunkel}
            />
            <Absatz
              text={inhalt}
              box={{ x: RAND + 3.7, y: y + 0.1, w: 3.4, h: 0.4 }}
              groesse={13}
            />
            <Absatz
              text={zeit}
              box={{ x: 7.6, y: y + 0.08, w: 1.8, h: 0.4 }}
              groesse={12}
              ausrichtung="right"
            />
            {index < agenda.length - 1 ? (
              <Line
                x1={RAND}
                x2={RAND + BREITE}
                y1={y + 0.57}
                y2={y + 0.57}
                style={{ color: FARBE.linie, width: 0.75 }}
              />
            ) : null}
          </Fragment>
        );
      })}
    </InhaltFolie>
  ),

  // Kriterium 3.1, 4.1: Analyse des Auftrags, Vorgaben
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={0}
      titel="5'200 Dateien, die niemand von Hand auswertet"
      untertitel="Ausgangslage und Auftrag der Energieagentur Bünzli"
      breite={5.3}
      punkte={[
        "Messdaten eines Gebäudes mit Solaranlage, als sdat- und ESL-Dateien",
        "sdat: Verbrauch pro 15 Minuten · ESL: absolute Zählerstände",
        "Auftrag: einlesen, in Zählerstände umrechnen, darstellen, als CSV exportieren",
        "Für Mitarbeitende ohne Programmierkenntnisse",
      ]}
      notes={
        "Ennio · 0:50 (bis 1:40)\n" +
        "Die Energieagentur Bünzli erhält die Daten eines Stromzählers in einem Gebäude mit Solaranlage, rund 5'200 XML-Dateien. " +
        "Die sdat-Dateien enthalten den Verbrauch pro Viertelstunde, die ESL-Dateien die absoluten Zählerstände. " +
        "Unser Auftrag war eine Webapplikation, die beides einliest, in Zählerstände umrechnet, in Diagrammen zeigt und als CSV exportiert. " +
        "Verarbeitet werden nur die Sensoren ID742 für den Bezug und ID735 für die Einspeisung, das hat Herr Bünzli per E-Mail bestätigt."
      }
    >
      <Kennzahl
        wert="5'133"
        label="sdat-Dateien, Verbrauch pro 15 Min."
        x={6.65}
        y={OBEN + 0.15}
        w={2.6}
      />
      <Kennzahl
        wert="47"
        label="ESL-Dateien, absolute Zählerstände"
        x={6.65}
        y={OBEN + 1.15}
        w={2.6}
      />
      <Kennzahl
        wert="2"
        label="Sensoren: ID742 Bezug, ID735 Einspeisung"
        x={6.65}
        y={OBEN + 2.15}
        w={2.6}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.2, 6.2: Team und Rollen nach Stärken, Vorgehen
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={0}
      titel="Fünf Rollen, ein Board, sechs Phasen"
      untertitel="Projektteam und Vorgehen nach IPERKA mit Trello"
      notes={
        "Lasse · 0:50 (bis 2:30)\n" +
        "Jede Person hat eine Hauptrolle, zusätzlich haben alle am Code mitgearbeitet. " +
        "Wir arbeiten sequenziell nach IPERKA, weil die Anforderungen klar vorgegeben waren und das Projekt nur fünf Tage dauert. " +
        "Auf dem Trello-Board gibt es pro Projekttag eine Liste, jede Karte trägt Tag, Nummer, Rolle und Priorität, zum Beispiel «T3-4 · Verbrauchs- und Zählerstanddiagramm [UI · Must]»."
      }
    >
      <Absatz
        text="Team"
        box={{ x: RAND, y: OBEN, w: 4, h: 0.32 }}
        groesse={14}
        farbe={FARBE.dunkel}
        fett
      />
      {team.map(([name, rolle], index) => {
        const y = OBEN + 0.48 + index * 0.52;
        return (
          <Fragment key={index}>
            <Absatz
              text={name}
              box={{ x: RAND, y, w: 2.1, h: 0.36 }}
              groesse={14}
              farbe={FARBE.dunkel}
            />
            <Absatz
              text={rolle}
              box={{ x: RAND + 2.15, y: y + 0.02, w: 2.0, h: 0.36 }}
              groesse={13}
            />
            <Line
              x1={RAND}
              x2={RAND + 4.1}
              y1={y + 0.43}
              y2={y + 0.43}
              style={{ color: FARBE.linie, width: 0.75 }}
            />
          </Fragment>
        );
      })}
      <Absatz
        text="Vorgehen"
        box={{ x: 5.3, y: OBEN, w: 4, h: 0.32 }}
        groesse={14}
        farbe={FARBE.dunkel}
        fett
      />
      <Punkte
        box={{ x: 5.3, y: OBEN + 0.48, w: 4.1, h: 2.9 }}
        groesse={14}
        items={[
          "IPERKA, weil Anforderungen fix und nur 5 Projekttage",
          "Trello: pro Projekttag eine Liste entlang der Phasen",
          "Karten mit Tag-Nr., Rolle und Priorität (Must, Should, Could, Doku)",
          "Rollen setzen den Schwerpunkt, alle arbeiten am Code mit",
        ]}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.3: Phase Informieren (Ziele, Pflichtenheft, Kosten)
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={1}
      titel="Messbare Ziele, priorisierte Anforderungen"
      untertitel="Informieren: SMART-Ziele, Pflichtenheft nach MoSCoW, Kostenkalkulation"
      notes={
        "Ennio · 0:50 (bis 3:20)\n" +
        "Wir haben fünf SMART-Ziele formuliert, zum Beispiel dass alle lesbaren Dateien eingelesen werden und unlesbare in einer Fehlerliste landen. " +
        "Das Pflichtenheft umfasst 23 Anforderungen nach MoSCoW, neun davon sind Must, F01 bis F09. " +
        "Dazu kommen nichtfunktionale Anforderungen wie ein Import aller Testdaten in höchstens 60 Sekunden. " +
        "Die Kosten betragen CHF 18'280 für 25 Personentage, damit ist es ein Kleinprojekt."
      }
    >
      <Kennzahl
        wert="Z1–Z5"
        label="SMART-Ziele, alle bis zur Abgabe am 02.10.2026"
        x={RAND}
        y={OBEN}
        w={2.7}
      />
      <Kennzahl
        wert="9 / 23"
        label="Must-Anforderungen (F01–F09) von allen, nach MoSCoW"
        x={RAND + 3.05}
        y={OBEN}
        w={2.7}
      />
      <Kennzahl
        wert="CHF 18'280"
        label="25 Personentage, 200 h, Kleinprojekt"
        x={RAND + 6.1}
        y={OBEN}
        w={2.7}
      />
      <Line
        x1={RAND}
        x2={RAND + BREITE}
        y1={OBEN + 1.32}
        y2={OBEN + 1.32}
        style={{ color: FARBE.linie, width: 0.75 }}
      />
      <Punkte
        box={{ x: RAND, y: OBEN + 1.52, w: BREITE, h: 1.8 }}
        groesse={15}
        items={[
          "Import aller Testdaten in höchstens 60 Sekunden",
          "Zählerstände weichen an ESL-Zeitpunkten höchstens 1 kWh ab",
          "Daten bleiben auf dem Gerät, ausser beim ausgelösten HTTP-POST",
          "Fachregeln FR1–FR7, z. B. intern immer UTC, bei Duplikaten gewinnt die neuste Datei",
        ]}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.4: Phase Planen (PSP, Gantt, Meilensteine)
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={1}
      titel="Der kritische Pfad lag in der Datenlogik"
      untertitel="Planen: T1-5 → T2-1 → T2-2 → T2-3 / T2-4 → T3-1 / T3-2 → T4-1"
      links={{
        titel: "Projektstrukturplan",
        bild: "psp.png",
        text: "6 Teilprojekte nach IPERKA, 32 Arbeitspakete",
      }}
      rechts={{
        titel: "Gantt und Meilensteine",
        bild: "gantt.png",
        text: "Halbtage, Farbe = Rolle · M1–M7, M5 Abgabe Fr 08:45",
      }}
      notes={
        "Lasse · 0:40 (bis 4:00)\n" +
        "Der Projektstrukturplan gliedert das Projekt nach IPERKA in sechs Teilprojekte mit 32 Arbeitspaketen, die Nummern stimmen mit dem Gantt und den Trello-Karten überein. " +
        "Das Gantt zeigt den Plan in Halbtagen, die Farbe steht für die Rolle, die Rauten für die sieben Meilensteine. " +
        "Der kritische Pfad verläuft über die Datenlogik: Verzögert sich ein Paket dort, verschieben sich alle Oberflächen-Arbeiten."
      }
    />
  ),

  // Kriterium 3.5: Phase Entscheiden (Nutzwertanalyse, Risiken)
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={1}
      titel="Drei Nutzwertanalysen, ein klarer Entscheid"
      untertitel="Entscheiden: Web-App mit Next.js, Diagramme mit bklit, keine Datenbank"
      notes={
        "Lasse · 0:50 (bis 4:50)\n" +
        "Wir haben drei Nutzwertanalysen gemacht: für den Technologie-Stack, die Diagramm-Bibliothek und die Datenhaltung. " +
        "Next.js gewinnt, weil die App ohne Installation im Browser läuft, bklit nur knapp vor ECharts, weil es zu unserem Design passt und ein Prototyp existierte. " +
        "Das grösste Risiko war der Wechsel der Sensor-IDs ab 2023 mit Wert 9, das haben wir schon im Parser gelöst."
      }
    >
      {nutzwert.map(([thema, sieger, note, rest], index) => {
        const y = OBEN + index * 0.95;
        return (
          <Fragment key={index}>
            <Absatz
              text={thema}
              box={{ x: RAND, y, w: 2.5, h: 0.3 }}
              groesse={11}
            />
            <Absatz
              text={sieger}
              box={{ x: RAND, y: y + 0.26, w: 2.6, h: 0.45 }}
              groesse={20}
              farbe={FARBE.dunkel}
              fett
            />
            <Absatz
              text={note}
              box={{ x: RAND + 2.7, y: y + 0.26, w: 1.0, h: 0.45 }}
              groesse={20}
              farbe={FARBE.gelb}
              fett
            />
            <Absatz
              text={rest}
              box={{ x: RAND, y: y + 0.66, w: 4.2, h: 0.26 }}
              groesse={10}
              farbe={FARBE.hell}
            />
          </Fragment>
        );
      })}
      <Absatz
        text="Grösste Risiken"
        box={{ x: 5.55, y: OBEN, w: 3.85, h: 0.32 }}
        groesse={14}
        farbe={FARBE.dunkel}
        fett
      />
      <Punkte
        box={{ x: 5.55, y: OBEN + 0.48, w: 3.85, h: 2.6 }}
        groesse={12}
        items={[
          "R1 Sensor-IDs wechseln ab 2023 (Wert 9): Richtung aus dem XML-Element, im Parser gelöst",
          "R4 Diagramm-Performance (6): vorberechnete Auflösungen",
          "R8 Doku bleibt liegen (6): tägliche Doku-Zeit, Feature-Stopp an Tag 5",
        ]}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.5: Mockups / Entwurf
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={1}
      titel="Vom Figma-Mockup zur fertigen Oberfläche"
      untertitel="Entwurf für alle fünf Ansichten, angepasst nach Absprache mit Herrn Bünzli"
      links={{
        titel: "Mockup in Figma",
        bild: "mockup-dashboard.png",
        text: "Entwurf Dashboard",
      }}
      rechts={{
        titel: "Umsetzung in Flux",
        bild: "dashboard.png",
        text: "Dashboard mit den Beispieldaten",
      }}
      notes={
        "Gonçalo · 0:30 (bis 5:20)\n" +
        "In Figma haben wir Mockups für Import, Dashboard, Verbrauch, Zählerstand und Export erstellt. " +
        "Nachdem mit Herrn Bünzli geklärt war, welche Daten genau dargestellt werden müssen, haben wir die Mockups angepasst. " +
        "Links sehen Sie den Entwurf des Dashboards, rechts die Umsetzung mit den echten Beispieldaten."
      }
    />
  ),

  // Kriterium 3.6, 4.2: Phase Realisieren, Standards
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={2}
      titel="Alles läuft im Browser, nichts verlässt den Rechner"
      untertitel="Realisieren: Verarbeitung in einem Web Worker, die Seiten lesen nur aus dem Data Store"
      notes={
        "Paul · 0:45 (bis 6:05)\n" +
        "Die ausgewählten Dateien gehen an einen Web Worker, damit die Seite beim Einlesen von rund 5'200 Dateien nicht einfriert. " +
        "Die Parser werfen nie einen Fehler: Defekte Dateien landen in der Fehlerliste, der Rest läuft weiter. " +
        "Danach werden Duplikate entfernt, Lücken erkannt, Zählerstände berechnet und alle Zoomstufen einmal vorberechnet, die Seiten lesen nur noch aus dem Data Store. " +
        "Für die Qualität setzen wir auf TypeScript, ESLint, Prettier und automatisierte Tests mit Vitest."
      }
    >
      {pipeline.map((schritt, index) => {
        const w = 1.32;
        const abstand = (BREITE - pipeline.length * w) / (pipeline.length - 1);
        const x = RAND + index * (w + abstand);
        return (
          <Fragment key={index}>
            <Rechteck
              box={{ x, y: OBEN + 0.05, w, h: 0.03 }}
              farbe={index === 1 ? FARBE.gelb : FARBE.dunkel}
            />
            <Absatz
              text={String(index + 1)}
              box={{ x, y: OBEN + 0.18, w: 0.4, h: 0.25 }}
              groesse={10}
              farbe={FARBE.hell}
            />
            <Absatz
              text={schritt}
              box={{ x, y: OBEN + 0.42, w, h: 0.55 }}
              groesse={12}
              farbe={FARBE.dunkel}
              fett
            />
          </Fragment>
        );
      })}
      <Punkte
        box={{ x: RAND, y: OBEN + 1.35, w: BREITE, h: 1.95 }}
        groesse={14}
        items={[
          "Web Worker hält die Oberfläche beim Import bedienbar",
          "Parser werfen nie: defekte Dateien landen in der Fehlerliste",
          "Next.js 16, React 19, TypeScript, Tailwind CSS, SVG-Diagramme mit d3-shape",
          "Standards: ESLint, Prettier, automatisierte Tests mit Vitest",
        ]}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.6, 6.6: Problem gelöst, gewissenhaft (Tests zuerst)
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={2}
      titel="Der Faktor 3: negative Zählerstände verhindert"
      untertitel="Problem und Lösung aus Karte T3-11"
      links={{
        titel: "Problem",
        punkte: [
          "sdat-Summen sind etwa 3-mal so gross wie die ESL-Differenzen",
          "Einfaches Aufaddieren macht 2018 negativ (bis etwa −28'000 kWh)",
          "Systemtest T04: NOK",
        ],
      }}
      rechts={{
        titel: "Lösung",
        punkte: [
          "Zuerst Tests geschrieben, dann die Berechnung angepasst",
          "sdat zwischen zwei ESL-Ablesungen skaliert, jede Ablesung wird genau getroffen",
          "2018 mit sdat ÷ 3 zurückgerechnet",
          "Nachtest T04b: OK, nie mehr negativ",
        ],
      }}
      notes={
        "Elias · 0:40 (bis 6:45)\n" +
        "Die sdat-Werte sind etwa dreimal so gross wie die Differenzen der ESL-Zählerstände, das hat Herr Bünzli bestätigt. " +
        "Unsere erste Berechnung hat deshalb für 2018 negative Zählerstände ergeben, der Systemtest T04 war nicht bestanden. " +
        "Wir haben zuerst Tests geschrieben und dann die Berechnung so angepasst, dass die sdat-Werte zwischen zwei Ablesungen skaliert werden und jede Ablesung genau getroffen wird. " +
        "Im Nachtest T04b stimmen Start- und Endwerte, und der Zählerstand ist nie mehr negativ."
      }
    >
      <Trenner y={4.12} />
      <Absatz
        text="Ergebnis"
        box={{ x: RAND, y: 4.27, w: 2, h: 0.3 }}
        groesse={12}
        farbe={FARBE.dunkel}
        fett
      />
      <Absatz
        text="Der Zählerstand steigt stetig: 2018 beginnt er bei 3'569.9 kWh (Bezug) und 6'435.3 kWh (Einspeisung)"
        box={{ x: RAND, y: 4.53, w: BREITE, h: 0.32 }}
        groesse={12}
        farbe={FARBE.dunkel}
      />
    </ZweiSpalten>
  ),

  // Kriterium 4.1, 2.7: Produkt erfüllt die Vorgaben, Highlight vor der Demo
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={2}
      titel="Von 5'180 Dateien zu einer Übersicht"
      untertitel="Import vorher und nachher, mit den Beispieldaten des Auftraggebers"
      links={{
        titel: "Vorher",
        bild: "import-vorher.png",
        text: "Dateien oder ganzen Ordner hineinziehen",
      }}
      rechts={{
        titel: "Nachher",
        bild: "import-nachher.png",
        text: "Dateiliste, Fehler, ignorierte Sensoren, Zusammenfassung",
      }}
      notes={
        "Elias · 0:20 (bis 7:05)\n" +
        "Links die leere Import-Seite: Man zieht einfach Dateien oder einen ganzen Ordner hinein. " +
        "Rechts dasselbe nach dem Import aller 5'180 Beispieldateien mit Zusammenfassung pro Sensor, entfernten Duplikaten und ignorierten Dateien. " +
        "Das zeigen wir Ihnen jetzt live."
      }
    />
  ),

  // Kriterium 2.7, 2.8: Demo mit Highlights, höchstens 5 Minuten
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={2}
      titel="Live-Demo"
      untertitel="Höchstens 5 Minuten · Paul klickt, Elias erklärt"
      notes={
        "Paul und Elias · 4:15 (bis 11:20)\n" +
        "Die Daten vor der Präsentation importieren (der volle Import dauert rund eine Minute) und die Demo nicht mit einem Neuladen der Seite starten. " +
        "Ablauf: Import-Zusammenfassung, Dashboard mit Hinweisen, Verbrauch von Jahr bis Tag mit Drill-down, Zählerstand mit ESL-Punkten, Export als CSV und JSON. " +
        "Bei Problemen auf die Backup-Folien im Anhang wechseln. Spätestens bei 11:20 zur nächsten Folie."
      }
    >
      {demo.map(([schritt, zeit], index) => {
        const y = OBEN + 0.05 + index * 0.6;
        return (
          <Fragment key={index}>
            <Absatz
              text={String(index + 1)}
              box={{ x: RAND, y, w: 0.4, h: 0.45 }}
              groesse={18}
              farbe={FARBE.gelb}
              fett
            />
            <Absatz
              text={schritt}
              box={{ x: RAND + 0.45, y: y + 0.03, w: 3.6, h: 0.5 }}
              groesse={13}
              farbe={FARBE.dunkel}
            />
            <Absatz
              text={zeit}
              box={{ x: RAND + 3.9, y: y + 0.05, w: 0.6, h: 0.4 }}
              groesse={11}
              ausrichtung="right"
            />
          </Fragment>
        );
      })}
      <Bild
        name="verbrauch-jahr.png"
        box={{ x: 5.3, y: OBEN, w: 4.1, h: UNTEN - OBEN }}
        ausrichtung="oben"
      />
    </InhaltFolie>
  ),

  // Kriterium 3.7, 4.3: Phase Kontrollieren (Testprotokoll), Produkt fehlerfrei
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={3}
      titel="Getestet auf zwei Ebenen"
      untertitel="Kontrollieren: Unit-Tests mit Vitest und Systemtests mit allen 5'180 Beispieldateien"
      breite={5.4}
      punkte={[
        "T01 sdat: 3'425 Dateien gelesen, 0 Fehler, 1'708 anderer Sensoren ignoriert",
        "T03: 31'644 Duplikate entfernt, 128'888 Platzhalter übersprungen",
        "T04 NOK (2018 negativ), nach T3-11 in T04b OK",
        "[TODO: T05–T08 (Diagramme, CSV, JSON/POST) testen und eintragen]",
      ]}
      notes={
        "Gonçalo · 0:50 (bis 12:10)\n" +
        "Wir testen auf zwei Ebenen: Unit-Tests für die ganze Datenlogik und Systemtests gegen das Pflichtenheft mit allen Beispieldaten. " +
        "Die automatisierten Tests laufen mit npm test und sind alle grün. " +
        "Im Systemtest wurden die sdat- und ESL-Dateien ohne Fehler gelesen, und der Fehler aus T04 wurde mit der neuen Berechnung behoben und nachgetestet."
      }
    >
      <Kennzahl
        wert="240"
        label="automatisierte Tests in 21 Dateien, alle grün (Stand 01.10.2026)"
        x={6.65}
        y={OBEN + 0.2}
        w={2.6}
      />
      <Kennzahl
        wert="5 / 4"
        label="Systemtests T01–T04b durchgeführt / bestanden"
        x={6.65}
        y={OBEN + 1.45}
        w={2.6}
      />
    </InhaltFolie>
  ),

  // Kriterium 3.7: Soll-Ist-Vergleich und Abnahme
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={3}
      titel="Soll-Ist-Vergleich und Abnahme"
      untertitel="Kontrollieren: Ziele, Zeit und Termine gegenüber der Planung"
      punkte={[
        "Umgesetzt: alle Muss-Funktionen, dazu JSON-Export, HTTP-POST, Dashboard, Drill-down und Login",
        "[TODO: Ziele Z1–Z5 erreicht? (ja / teilweise / nein)]",
        "[TODO: Ist-Stunden aus dem Arbeitsjournal gegenüber Soll]",
        "[TODO: Ist-Termine der Meilensteine M1–M7]",
        "[TODO: Abnahme durch Roger Bünzli (Datum, Entscheid)]",
      ]}
      notes={
        "Ennio · 0:40 (bis 12:50)\n" +
        "Laut Fazit der Dokumentation ist das Projektziel erreicht: Alle Muss-Funktionen sind umgesetzt, dazu JSON-Export, HTTP-POST, Dashboard, Drill-down und Login. " +
        "[TODO: Soll-Ist bei Zeit und Terminen in einem Satz zusammenfassen.] " +
        "[TODO: Ergebnis der Abnahme nennen.]"
      }
    />
  ),

  // Kriterium 3.8, 6.2: Phase Auswerten (Team-Reflexion)
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={4}
      titel="Was wir als Team mitnehmen"
      untertitel="Auswerten: Team-Reflexion"
      links={{
        titel: "Lief gut",
        punkte: [
          "Aufgaben nach Stärken verteilt, alle hatten durchgehend zu tun",
          "Kaum Uneinigkeiten, Probleme schnell gemeinsam besprochen",
        ],
      }}
      rechts={{
        titel: "Lief schlecht",
        punkte: [
          "Neue Technologien wie useSyncExternalStore und fast-xml-parser kosteten Einarbeitung",
          "Letzte Tickets dauerten länger: Zeitdruck an Tag 4 und 5",
        ],
      }}
      notes={
        "Gonçalo · 0:45 (bis 13:35)\n" +
        "Gut lief die Zusammenarbeit: Wir konnten nach unseren Stärken arbeiten und Probleme schnell gemeinsam lösen. " +
        "Unterschätzt haben wir die Einarbeitung in neue Technologien, dadurch gerieten wir an Tag 4 und 5 unter Zeitdruck. " +
        "Nächstes Mal schätzen wir die Tickets auf dem Board, gehen schwierige Aufgaben früher an, planen einen Zeitpuffer und führen ein kurzes Daily ein."
      }
    >
      <Trenner y={4.12} />
      <Absatz
        text="Nächstes Mal"
        box={{ x: RAND, y: 4.27, w: 2, h: 0.3 }}
        groesse={12}
        farbe={FARBE.dunkel}
        fett
      />
      <Absatz
        text="Zeitschätzungen auf den Trello-Karten, schwierige Tickets früher, Zeitpuffer für die letzten Tage, kurzes Daily"
        box={{ x: RAND, y: 4.53, w: BREITE, h: 0.32 }}
        groesse={12}
        farbe={FARBE.dunkel}
      />
    </ZweiSpalten>
  ),

  // Kriterium 5.1, 5.2, 5.3: persönliche Reflexion (Zielerreichung, Teamspirit, Lessons learned)
  (nr: number) => (
    <InhaltFolie
      nr={nr}
      teil={4}
      titel="Persönliche Lessons learned"
      untertitel="Ein Satz pro Person zu Zielerreichung, Teamspirit und dem, was wir mitnehmen"
      notes={
        "Alle · 0:40 (bis 14:15), je etwa 8 Sekunden\n" +
        "Jede Person sagt einen Satz zu ihrem wichtigsten Learning. " +
        "[TODO: Sätze aus den persönlichen Reflexionen übernehmen.]"
      }
    >
      {team.map(([name], index) => {
        const y = OBEN + index * 0.64;
        return (
          <Fragment key={index}>
            <Absatz
              text={name}
              box={{ x: RAND, y, w: 2.2, h: 0.4 }}
              groesse={14}
              farbe={FARBE.dunkel}
              fett
            />
            <Absatz
              text={`[TODO: Lesson learned von ${name.split(" ")[0]}]`}
              box={{ x: RAND + 2.3, y: y + 0.02, w: 6.5, h: 0.4 }}
              groesse={13}
            />
            {index < team.length - 1 ? (
              <Line
                x1={RAND}
                x2={RAND + BREITE}
                y1={y + 0.52}
                y2={y + 0.52}
                style={{ color: FARBE.linie, width: 0.75 }}
              />
            ) : null}
          </Fragment>
        );
      })}
    </InhaltFolie>
  ),

  // Kriterium 3.8, 5.1: Fazit, Zielerreichung, Ausblick
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={4}
      titel="Projektziel erreicht"
      untertitel="Fazit und Ausblick"
      links={{
        titel: "Erreicht",
        punkte: [
          "Liest die rund 5'200 Dateien, rechnet Zählerstände, zeigt Diagramme, exportiert CSV",
          "Zusätzlich: JSON-Export, HTTP-POST, Dashboard, Drill-down, Login",
        ],
      }}
      rechts={{
        titel: "Ausblick",
        punkte: [
          "Daten im Browser zwischenspeichern (F17)",
          "Zählerstände für die Zeit ohne ESL-Werte hochrechnen",
        ],
      }}
      notes={
        "Paul · 0:30 (bis 14:45)\n" +
        "Das Projektziel ist erreicht: Flux liest die Dateien ein, rechnet die Zählerstände, zeigt Bezug und Einspeisung in Diagrammen und exportiert die Daten. " +
        "Die Energieagentur Bünzli kann die Daten damit ohne Programmierkenntnisse und ohne Installation auswerten. " +
        "Als Weiterentwicklung bieten sich das Zwischenspeichern im Browser und eine Hochrechnung für die Zeit ohne ESL-Werte an."
      }
    >
      <Trenner y={3.85} />
      <Absatz
        text="Die Energieagentur Bünzli kann die Zählerdaten ohne Programmierkenntnisse und ohne Installation im Browser auswerten."
        box={{ x: RAND, y: 4.0, w: BREITE, h: 0.85 }}
        groesse={18}
        farbe={FARBE.dunkel}
      />
    </ZweiSpalten>
  ),

  // Kriterium 2.2, 2.6: Verabschiedung, Schlussfolie
  (nr: number) => (
    <AbschlussFolie
      nr={nr}
      notes={
        "Lasse · 0:15 (bis 15:00)\n" +
        "Wir danken Herrn Bünzli für den spannenden Auftrag und Ihnen für Ihre Aufmerksamkeit. " +
        "Wir freuen uns jetzt auf Ihre Fragen und das Fachgespräch."
      }
    />
  ),

  // Kriterium 2.7: Backup für die Demo (nicht Teil der 15 Minuten)
  (nr: number) => (
    <BildFolie
      nr={nr}
      teil={null}
      titel="Anhang: Dashboard"
      untertitel="Backup für die Demo · Kennzahlen, Monatswerte, Jahresvergleich und Hinweise"
      name="dashboard.png"
      notes="Backup-Folie, nur bei Problemen mit der Live-Demo zeigen. Kennzahlen für den ganzen Zeitraum, Monatswerte mit unvollständigen Monaten und Hinweise zu den Daten."
    />
  ),
  // Kriterium 2.7: Backup für die Demo
  (nr: number) => (
    <ZweiSpalten
      nr={nr}
      teil={null}
      titel="Anhang: Verbrauch"
      untertitel="Backup für die Demo · vom Jahr bis zur Viertelstunde"
      links={{
        titel: "Jahr 2020",
        bild: "verbrauch-jahr.png",
        text: "Wochenwerte, ein Klick im Diagramm öffnet die nächste Stufe",
      }}
      rechts={{
        titel: "Tag 15.07.2020",
        bild: "verbrauch-tag.png",
        text: "15-Minuten-Werte von Bezug und Einspeisung",
      }}
      notes="Backup-Folie, nur bei Problemen mit der Live-Demo zeigen. Links das Jahr 2020, rechts ein einzelner Tag mit 15-Minuten-Werten."
    />
  ),
  // Kriterium 2.7: Backup für die Demo
  (nr: number) => (
    <BildFolie
      nr={nr}
      teil={null}
      titel="Anhang: Zählerstand"
      untertitel="Backup für die Demo · berechnete Zählerstände und ESL-Ablesungen"
      name="zaehlerstand.png"
      notes="Backup-Folie, nur bei Problemen mit der Live-Demo zeigen. Zählerstände aus sdat und ESL berechnet, nach September 2021 nur noch ESL-Werte."
    />
  ),
  // Kriterium 2.7: Backup für die Demo
  (nr: number) => (
    <BildFolie
      nr={nr}
      teil={null}
      titel="Anhang: Export"
      untertitel="Backup für die Demo · CSV pro Sensor, JSON oder HTTP-POST an einen Server"
      name="export.png"
      notes="Backup-Folie, nur bei Problemen mit der Live-Demo zeigen. Export als CSV pro Sensor, als JSON-Datei oder per HTTP-POST an eine einstellbare Server-URL."
    />
  ),
];

// Überblenden zwischen den Folien, react-pptx kennt keine Übergänge
async function mitUebergaengen(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const dateien = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  for (const name of dateien) {
    const xml = await zip.file(name)!.async("string");
    if (xml.includes("<p:transition")) continue;
    zip.file(
      name,
      xml.replace(
        "</p:clrMapOvr>",
        '</p:clrMapOvr><p:transition spd="med"><p:fade/></p:transition>',
      ),
    );
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  const buffer = (await render(
    <Presentation
      layout="16x9"
      title="Flux · Projektpräsentation M306 Gruppe 4"
      author="M306 Gruppe 4"
      company="KSH / IM24"
    >
      {folien.map((folie, index) => folie(index + 1))}
    </Presentation>,
  )) as Buffer;
  fs.writeFileSync(AUSGABE, await mitUebergaengen(buffer));
  console.log(
    `${folien.length} Folien gespeichert: ${path.relative(ROOT, AUSGABE)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
