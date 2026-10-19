// HTML für die Sharepics. Gerendert wird es von scripts/grafiken.mjs mit Chromium.
//
// Folie 1 „Übersicht“: Parteien mit Stimmen und Mehrheitsvotum, Piraten-Kasten hervorgehoben.
// Folie 2 „Abgeordnete“: alle deutschen Abgeordneten mit Gesicht und Votum, nach Partei gruppiert.

// feed: Instagram/Facebook/X/Bluesky/Mastodon (4:5). hoch: TikTok und Stories (9:16).
export const FORMATE = {
  feed: { name: "feed", breite: 1080, hoehe: 1350 },
  hoch: { name: "hoch", breite: 1080, hoehe: 1920 },
};

// Platzhalterfarben, solange kein Logo unter assets/logos/ liegt.
export const FARBEN = {
  "CDU": ["#1f2a36", "#fff"],
  "CSU": ["#0080c8", "#fff"],
  "SPD": ["#e3000f", "#fff"],
  "AfD": ["#009ee0", "#fff"],
  "Grüne": ["#1aa037", "#fff"],
  "FDP": ["#ffed00", "#1d1d1b"],
  "Linke": ["#be3075", "#fff"],
  "BSW": ["#792351", "#fff"],
  "Freie Wähler": ["#f7a800", "#1d1d1b"],
  "Volt": ["#502379", "#fff"],
  "Die PARTEI": ["#b5152b", "#fff"],
  "ÖDP": ["#ff6400", "#fff"],
  "Familie": ["#e8740c", "#fff"],
  "Tierschutz": ["#00708c", "#fff"],
  "PdF": ["#4a3a8c", "#fff"],
  "PIRATEN": ["#ff8800", "#fff"],
  "Parteilos": ["#8a8f98", "#fff"],
};

const MONATE = ["Jan", "Feb", "März", "Apr", "Mai", "Juni", "Juli", "Aug", "Sep", "Okt", "Nov", "Dez"];

export function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);
}

export function slug(partei) {
  return partei.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Farben der Stimmen. Helles Grün und dunkles Rot bleiben auch bei Rot-Grün-Schwäche unterscheidbar
// (geprüft: ΔE 16 bei Deuteranopie); dazu tragen Symbole und Zahlen die Bedeutung, nie die Farbe allein.
export const STIMMFARBEN = { FOR: "#3fae49", AGAINST: "#b3122e", ABSTENTION: "#8f8a85", DID_NOT_VOTE: "#d6d2cd" };
const F = STIMMFARBEN;

// Symbol im Stil der tschechischen Piraten-Grafiken.
export function badge(position, groesse = 44) {
  const s = groesse;
  const inhalt = {
    FOR: `<circle cx="50" cy="50" r="46" fill="${F.FOR}" stroke="#fff" stroke-width="6"/><path d="M27 52 L43 67 L74 34" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
    AGAINST: `<circle cx="50" cy="50" r="46" fill="${F.AGAINST}" stroke="#fff" stroke-width="6"/><path d="M33 33 L67 67 M67 33 L33 67" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`,
    ABSTENTION: `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#3a3a3a" stroke-width="5"/><path d="M30 50 L70 50" stroke="#8a8a8a" stroke-width="12" stroke-linecap="round"/>`,
    DID_NOT_VOTE: `<circle cx="50" cy="50" r="46" fill="#9d9792" stroke="#fff" stroke-width="6"/><text x="50" y="68" text-anchor="middle" font-family="Oswald" font-weight="600" font-size="52" fill="#fff">N</text>`,
    GESPALTEN: `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#3a3a3a" stroke-width="5"/><path d="M50 22 L50 78" stroke="#3a3a3a" stroke-width="6"/><path d="M24 50 L32 58 L44 42" fill="none" stroke="${F.FOR}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 42 L72 58 M72 42 L58 58" stroke="${F.AGAINST}" stroke-width="7" stroke-linecap="round"/>`,
  }[position];
  return `<svg class="badge" width="${s}" height="${s}" viewBox="0 0 100 100">${inhalt}</svg>`;
}

const REIHENFOLGE = ["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"];
const WORTE = {
  FOR: () => "dafür",
  AGAINST: () => "dagegen",
  ABSTENTION: (n) => (n === 1 ? "Enthaltung" : "Enthaltungen"),
  DID_NOT_VOTE: () => "ohne Stimme",
};

// Balken mit der Stimmverteilung; Segmente proportional, 2 px Abstand, Zahlen im Segment, wenn Platz ist.
export function verteilung(zahlen, { zahlenImBalken = false } = {}) {
  const gesamt = REIHENFOLGE.reduce((summe, k) => summe + (zahlen[k] ?? 0), 0) || 1;
  const segmente = REIHENFOLGE.filter((k) => zahlen[k] > 0).map((k) => {
    const text = zahlenImBalken && zahlen[k] / gesamt >= 0.07 ? zahlen[k] : "";
    return `<span class="segment segment-${k.toLowerCase()}" style="flex-grow:${zahlen[k]};background:${F[k]}">${text}</span>`;
  });
  return `<div class="balken">${segmente.join("")}</div>`;
}

// Zahlen unter dem Balken: Farbpunkt + Zahl, nur was vorkommt. Die Wörter stehen einmal in der Legende.
export function verteilungText(zahlen) {
  return REIHENFOLGE.filter((k) => zahlen[k] > 0)
    .map((k) => `<span class="zahl"><i style="background:${F[k]}"></i>${zahlen[k]}</span>`)
    .join("");
}

// Für Alternativtexte: „22 dafür, 1 ohne Stimme“.
export function verteilungWorte(zahlen) {
  return REIHENFOLGE.filter((k) => zahlen[k] > 0).map((k) => `${zahlen[k]} ${WORTE[k](zahlen[k])}`).join(", ");
}

// Parteien nach Lager: dafür, gespalten, Enthaltung, dagegen, ohne Stimme – innerhalb nach Größe.
const LAGER = { FOR: 0, GESPALTEN: 1, ABSTENTION: 2, AGAINST: 3, DID_NOT_VOTE: 4 };
export function nachLager(parteien) {
  const groesse = (p) => REIHENFOLGE.reduce((s, k) => s + (p[k] ?? 0), 0);
  return [...parteien].sort((a, b) => LAGER[a.mehrheit] - LAGER[b.mehrheit] || groesse(b) - groesse(a));
}

function logo(partei, assets) {
  const datei = assets.logos?.[slug(partei)];
  if (datei) return `<img class="logo" src="${esc(datei)}" alt="${esc(partei)}">`;
  const [bg, fg] = FARBEN[partei] ?? ["#555", "#fff"];
  return `<span class="logo logo-text" style="background:${bg};color:${fg}">${esc(partei)}</span>`;
}

function initialen(person) {
  return ((person?.vorname?.[0] ?? "") + (person?.nachname?.[0] ?? "")).toUpperCase();
}

// Foto über den Initialen: lässt es sich nicht laden, entfernt es sich und die Initialen bleiben sichtbar.
function gesicht(id, person, assets) {
  const leer = `<span class="foto foto-leer">${esc(initialen(person))}</span>`;
  const datei = assets.portraets?.[id];
  if (!datei) return leer;
  return `${leer}<img class="foto foto-bild" src="${esc(datei)}" alt="" onerror="this.remove()">`;
}

// Avatar für die Piraten: Silhouette mit Fragezeichen, weil kein deutscher Pirat im EP sitzt.
function piratenAvatar() {
  return `<svg class="foto" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice"><rect width="100" height="100" fill="#ffe2bf"/><circle cx="50" cy="38" r="20" fill="#ff8800"/><path d="M14 100 C14 70 30 60 50 60 C70 60 86 70 86 100 Z" fill="#ff8800"/><text x="50" y="47" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="30" fill="#fff">?</text></svg>`;
}

// Signet links im Kasten „So hätten die PIRATEN gestimmt“; ohne Signet-Datei der Avatar.
function piratenSignet(assets) {
  const datei = assets.logos?.["piraten-signet"];
  return datei ? `<img class="foto signet" src="${esc(datei)}" alt="PIRATEN">` : piratenAvatar();
}

function datum(abstimmung) {
  const [j, m, t] = abstimmung.zeitpunkt.slice(0, 10).split("-");
  return { lang: `${Number(t)}. ${MONATE[Number(m) - 1]} ${j}` };
}

function titelGroesse(titel, basis) {
  const n = titel.length;
  if (n <= 40) return basis;
  if (n <= 70) return Math.round(basis * 0.8);
  if (n <= 110) return Math.round(basis * 0.66);
  if (n <= 160) return Math.round(basis * 0.54);
  return Math.round(basis * 0.46);
}

// Stichpunkte der Zusammenfassung für die Übersicht: höchstens `anzahl`, jeder höchstens `zeichen` lang (am Wortende gekürzt).
export function erklaerungPunkte(punkte, { anzahl = 2, zeichen = 150 } = {}) {
  return (punkte ?? []).slice(0, anzahl).map((p) => {
    const text = p.replace(/\s+/g, " ").trim();
    if (text.length <= zeichen) return text;
    return text.slice(0, zeichen).replace(/\s+\S*$/, "").replace(/[,;:–-]$/, "") + " …";
  });
}

function erklaerung(abstimmung, format) {
  const punkte = erklaerungPunkte(abstimmung.zusammenfassung, format.name === "hoch" ? { anzahl: 3, zeichen: 170 } : {});
  if (!punkte.length) return "";
  return `
  <section class="erklaerung">
    <h3>Worum geht es?</h3>
    <ul>${punkte.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
  </section>`;
}

// Offizielle EP-Titel können sehr lang sein; mehr als MAX_TITEL Zeichen passen nicht in den Kopf.
const MAX_TITEL = 200;
export function titelKuerzen(titel) {
  if (titel.length <= MAX_TITEL) return titel;
  return titel.slice(0, MAX_TITEL).replace(/\s+\S*$/, "") + " …";
}

const POSITION_TEXT = { FOR: "Dafür", AGAINST: "Dagegen", ABSTENTION: "Enthaltung" };

function piratenHinweis(abstimmung) {
  return abstimmung.piraten.quelle === "regel"
    ? `Abweichend von Markéta Gregorová: ${esc(abstimmung.piraten.hinweis)}`
    : "Abgeleitet vom Votum der Piratin Markéta Gregorová (Piráti, CZ)";
}

function kopf(abstimmung, titel, basis, assets) {
  titel = titelKuerzen(titel);
  return `
  <header>
    <div class="kopfzeile">${kopfLogo(assets)}<div class="datum">EU-Parlament · ${esc(datum(abstimmung).lang)}</div></div>
    <h1 style="font-size:${titelGroesse(titel, basis)}px">${esc(titel)}</h1>
  </header>`;
}

// Oben links das ganze Logo in der Negativ-Variante (weiße Schrift für den dunklen Kopf,
// assets/logos/piraten-negativ.*), sonst das Signet, sonst ein Platzhalter.
function kopfLogo(assets) {
  const negativ = assets.logos?.["piraten-negativ"];
  if (negativ) return `<img class="kopflogo" src="${esc(negativ)}" alt="Piratenpartei Deutschland">`;
  const signet = assets.logos?.["piraten-signet"];
  if (signet) return `<img class="kopflogo signet" src="${esc(signet)}" alt="PIRATEN">`;
  return `<span class="kopflogo-leer">PIRATEN</span>`;
}

// Name der Accounts – steht unten rechts auf jeder Grafik, damit die Herkunft beim Weiterteilen sichtbar bleibt.
export const ABSENDER = "Piraten-Check EU";

function fuss(abstimmung, assets = {}) {
  const s = abstimmung.stimmen;
  const ergebnis = { ADOPTED: "angenommen", REJECTED: "abgelehnt" }[abstimmung.ergebnis] ?? "";
  const eintrag = (k, text) => `<span class="eintrag">${badge(k, 26)}${text} <b>${s[k]}</b></span>`;
  return `
  <footer>
    <div class="gesamt">
      <span class="label">EU-Parlament gesamt</span>
      <span class="ergebnis ${abstimmung.ergebnis === "ADOPTED" ? "ja" : "nein"}">${ergebnis}</span>
    </div>
    ${verteilung(s, { zahlenImBalken: true })}
    <div class="legende">
      ${eintrag("FOR", "Dafür")}${eintrag("AGAINST", "Dagegen")}${eintrag("ABSTENTION", "Enthaltung")}${eintrag("DID_NOT_VOTE", "Ohne Stimme")}
    </div>
    <div class="quelle"><span>Daten: HowTheyVote.eu · Fotos: © Europäische Union${abstimmung.zusammenfassung?.length && !abstimmung.erklaerungEigen ? `<span class="ki-quelle"> · Zusammenfassung: check-some-votes.eu (KI-generiert)</span>` : ""}</span><span class="absender">${assets.logos?.["piraten-signet"] ? `<img src="${assets.logos["piraten-signet"]}" alt="">` : ""}${esc(ABSENDER)}</span></div>
  </footer>`;
}

function seite(css, inhalt, format) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<style>${css}
html,body{margin:0;width:${format.breite}px;height:${format.hoehe}px;overflow:hidden}
</style></head><body><main class="karte format-${format.name}">${inhalt}</main></body></html>`;
}

export function uebersichtHtml(abstimmung, { titel, assets = {}, css, format = FORMATE.feed }) {
  const p = abstimmung.piraten;
  const sortiert = nachLager(abstimmung.deutschland);
  const parteien = sortiert.map((partei) => `
    <div class="partei">
      <div class="partei-logo">${logo(partei.partei, assets)}</div>
      <div class="verteilung">
        ${verteilung(partei)}
        <div class="verteilung-text">${verteilungText(partei)}</div>
      </div>
      ${badge(partei.mehrheit, 56)}
    </div>`).join("");
  // Spaltenweise lesen: links von oben nach unten, dann rechts.
  const zeilen = Math.ceil(sortiert.length / 2);

  return seite(css, `
  ${kopf(abstimmung, titel, 76, assets)}
  ${erklaerung(abstimmung, format)}
  <section class="piraten">
    <div class="avatar">${piratenSignet(assets)}</div>
    <div class="piraten-text">
      <div class="frage">So hätten die PIRATEN gestimmt: <b>${esc(POSITION_TEXT[p.position] ?? "–")}${p.quelle === "regel" ? "*" : ""}</b></div>
      <div class="hinweis">${piratenHinweis(abstimmung)}</div>
    </div>
    ${p.position ? badge(p.position, 120) : ""}
  </section>
  <h2>So stimmten die deutschen Parteien</h2>
  <section class="parteien" style="grid-template-rows:repeat(${zeilen}, auto);--zeile:${format.name === "hoch" ? 80 : 64}px">${parteien}</section>
  ${fuss(abstimmung, assets)}`, format);
}

// Höchstens so viele Gesichter pro Folie; Parteien werden nicht auf zwei Folien verteilt.
export const GESICHTER_PRO_FOLIE = 50;

// Gibt eine oder mehrere Folien zurück (je nach Anzahl der Abgeordneten).
export function abgeordneteFolien(abstimmung, { titel, personen, assets = {}, css, format = FORMATE.feed }) {
  const gruppen = new Map();
  for (const [id, partei, position] of abstimmung.abgeordnete) {
    if (!gruppen.has(partei)) gruppen.set(partei, []);
    gruppen.get(partei).push({ id, position, person: personen[id] });
  }
  // Reihenfolge wie in der Übersicht (nach Größe), innerhalb der Partei nach Nachname.
  const reihenfolge = abstimmung.deutschland.map((p) => p.partei).filter((p) => gruppen.has(p));

  // Jede Partei kommt auf die erste Folie, auf der sie noch Platz hat.
  const folien = [{ parteien: [], anzahl: 1 }]; // 1 = der Piraten-Avatar auf der ersten Folie
  for (const partei of reihenfolge) {
    const n = gruppen.get(partei).length;
    let folie = folien.find((f) => f.anzahl + n <= GESICHTER_PRO_FOLIE);
    if (!folie) folien.push((folie = { parteien: [], anzahl: 0 }));
    folie.parteien.push(partei);
    folie.anzahl += n;
  }

  const p = abstimmung.piraten;
  // Schmales Band über die ganze Breite: Signet, Position der PIRATEN, Symbol – wie der Kasten auf der Übersicht.
  const piraten = `
    <div class="piraten-band">
      ${piratenSignet(assets)}
      <div class="band-text">So hätten die PIRATEN gestimmt: <b>${esc(POSITION_TEXT[p.position] ?? "–")}${p.quelle === "regel" ? "*" : ""}</b></div>
      ${p.position ? badge(p.position, 56) : ""}
    </div>`;

  return folien.map(({ parteien, anzahl }, i) => {
    // Startgröße; scripts/grafiken.mjs verkleinert, bis alles auf die Folie passt.
    const start = anzahl <= 24 ? 150 : 140;
    const groesse = Math.round(start * (format.hoehe / FORMATE.feed.hoehe));
    const bloecke = parteien.map((partei) => {
      const leute = gruppen.get(partei).sort((a, b) => (a.person?.nachname ?? "").localeCompare(b.person?.nachname ?? "", "de"));
      return `
    <div class="gruppe">
      <div class="gruppe-logo">${logo(partei, assets)}</div>
      <div class="gesichter">${leute.map(({ id, position, person }) => `
        <figure>
          <div class="kopf">${gesicht(id, person, assets)}${badge(position, 34)}</div>
          <figcaption>${esc(name(person))}</figcaption>
        </figure>`).join("")}
      </div>
    </div>`;
    }).join("");
    return seite(css, `
  ${kopf(abstimmung, titel, 60, assets)}
  <section class="abgeordnete" style="--gesicht:${groesse}px">${i === 0 ? piraten : ""}${bloecke}</section>
  ${fuss(abstimmung, assets)}`, format);
  });
}

function name(person) {
  if (!person) return "";
  return nachname(person.nachname);
}

// EP schreibt Nachnamen in Großbuchstaben – für die Grafik normal schreiben.
const PARTIKEL = new Set(["von", "der", "zu", "van", "den", "vom"]);
export function nachname(text) {
  return text.toLowerCase().split(" ").map((wort, i) =>
    i > 0 && PARTIKEL.has(wort) ? wort : wort
      .replace(/(^|-)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
      .replace(/^Mc(\p{L})/u, (_, b) => "Mc" + b.toUpperCase()),
  ).join(" ");
}
