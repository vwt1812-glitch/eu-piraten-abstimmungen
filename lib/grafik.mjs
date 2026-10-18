// HTML für die Sharepics. Gerendert wird es von scripts/grafiken.mjs mit Chromium.
//
// Folie 1 „Übersicht“: Parteien mit Stimmen und Mehrheitsvotum, Piraten-Kasten hervorgehoben.
// Folie 2 „Abgeordnete“: alle deutschen Abgeordneten mit Gesicht und Votum, nach Partei gruppiert.

export const FORMATE = {
  feed: { breite: 1080, hoehe: 1350 },
};

// Platzhalterfarben, solange kein Logo unter assets/logos/ liegt.
const FARBEN = {
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

// Symbol im Stil der tschechischen Piraten-Grafiken.
export function badge(position, groesse = 44) {
  const s = groesse;
  const inhalt = {
    FOR: `<circle cx="50" cy="50" r="46" fill="#3fae49" stroke="#fff" stroke-width="6"/><path d="M27 52 L43 67 L74 34" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
    AGAINST: `<circle cx="50" cy="50" r="46" fill="#e2231a" stroke="#fff" stroke-width="6"/><path d="M33 33 L67 67 M67 33 L33 67" stroke="#fff" stroke-width="12" stroke-linecap="round"/>`,
    ABSTENTION: `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#3a3a3a" stroke-width="5"/><path d="M30 50 L70 50" stroke="#8a8a8a" stroke-width="12" stroke-linecap="round"/>`,
    DID_NOT_VOTE: `<circle cx="50" cy="50" r="46" fill="#9d9792" stroke="#fff" stroke-width="6"/><text x="50" y="68" text-anchor="middle" font-family="Oswald" font-weight="600" font-size="52" fill="#fff">N</text>`,
    GESPALTEN: `<circle cx="50" cy="50" r="46" fill="#fff" stroke="#3a3a3a" stroke-width="5"/><path d="M50 22 L50 78" stroke="#3a3a3a" stroke-width="6"/><path d="M24 50 L32 58 L44 42" fill="none" stroke="#3fae49" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 42 L72 58 M72 42 L58 58" stroke="#e2231a" stroke-width="7" stroke-linecap="round"/>`,
  }[position];
  return `<svg class="badge" width="${s}" height="${s}" viewBox="0 0 100 100">${inhalt}</svg>`;
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

function gesicht(id, person, assets) {
  const datei = assets.portraets?.[id];
  if (datei) return `<img class="foto" src="${esc(datei)}" alt="">`;
  return `<span class="foto foto-leer">${esc(initialen(person))}</span>`;
}

// Avatar für die Piraten: Silhouette mit Fragezeichen, weil kein deutscher Pirat im EP sitzt.
function piratenAvatar() {
  return `<svg class="foto" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffe2bf"/><circle cx="50" cy="38" r="20" fill="#ff8800"/><path d="M14 100 C14 70 30 60 50 60 C70 60 86 70 86 100 Z" fill="#ff8800"/><text x="50" y="47" text-anchor="middle" font-family="Oswald" font-weight="700" font-size="30" fill="#fff">?</text></svg>`;
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
  return Math.round(basis * 0.54);
}

const POSITION_TEXT = { FOR: "Dafür", AGAINST: "Dagegen", ABSTENTION: "Enthaltung" };

function piratenHinweis(abstimmung) {
  return abstimmung.piraten.quelle === "regel"
    ? `Abweichend von Markéta Gregorová: ${esc(abstimmung.piraten.hinweis)}`
    : "Abgeleitet vom Votum der Piratin Markéta Gregorová (Piráti, CZ)";
}

function kopf(abstimmung, titel, basis, assets) {
  return `
  <header>
    <div class="datum">EU-Parlament · ${esc(datum(abstimmung).lang)}</div>
    <h1 style="font-size:${titelGroesse(titel, basis)}px">${esc(titel)}</h1>
    <div class="ecklogo">${eckLogo(assets)}</div>
  </header>`;
}

// Piraten-Logo oben rechts; ohne assets/logos/piraten.* ein Platzhalter.
function eckLogo(assets) {
  const datei = assets.logos?.piraten;
  if (datei) return `<img src="${esc(datei)}" alt="Piratenpartei">`;
  return `<span class="ecklogo-leer">PIRATEN</span>`;
}

function fuss(abstimmung) {
  const s = abstimmung.stimmen;
  const ergebnis = { ADOPTED: "angenommen", REJECTED: "abgelehnt" }[abstimmung.ergebnis] ?? "";
  return `
  <footer>
    <div class="gesamt">
      <span class="label">EU-Parlament gesamt:</span>
      ${badge("FOR", 40)}<b>${s.FOR}</b> ${badge("AGAINST", 40)}<b>${s.AGAINST}</b> ${badge("ABSTENTION", 40)}<b>${s.ABSTENTION}</b>
      <span class="ergebnis ${abstimmung.ergebnis === "ADOPTED" ? "ja" : "nein"}">${ergebnis}</span>
    </div>
    <div class="legende">
      ${badge("FOR", 24)}Dafür ${badge("AGAINST", 24)}Dagegen ${badge("ABSTENTION", 24)}Enthaltung ${badge("DID_NOT_VOTE", 24)}Nicht abgestimmt
      <span class="quelle">Daten: HowTheyVote.eu · Fotos: © Europäische Union</span>
    </div>
  </footer>`;
}

function seite(css, inhalt, format) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<style>${css}
html,body{margin:0;width:${format.breite}px;height:${format.hoehe}px;overflow:hidden}
</style></head><body><main class="karte">${inhalt}</main></body></html>`;
}

export function uebersichtHtml(abstimmung, { titel, assets = {}, css, format = FORMATE.feed }) {
  const p = abstimmung.piraten;
  const parteien = abstimmung.deutschland.map((partei) => `
    <div class="partei">
      <div class="partei-logo">${logo(partei.partei, assets)}</div>
      <div class="zahlen">
        ${["FOR", "AGAINST", "ABSTENTION", "DID_NOT_VOTE"].map((k) => `<span class="${partei[k] ? "" : "null"}">${badge(k, 22)}${partei[k]}</span>`).join("")}
      </div>
      ${badge(partei.mehrheit, 64)}
    </div>`).join("");

  return seite(css, `
  ${kopf(abstimmung, titel, 76, assets)}
  <section class="piraten">
    <div class="avatar">${piratenAvatar()}</div>
    <div class="piraten-text">
      <div class="partei-logo">${logo("PIRATEN", assets)}</div>
      <div class="frage">So hätten die PIRATEN gestimmt: <b>${esc(POSITION_TEXT[p.position] ?? "–")}${p.quelle === "regel" ? "*" : ""}</b></div>
      <div class="hinweis">${piratenHinweis(abstimmung)}</div>
    </div>
    ${p.position ? badge(p.position, 120) : ""}
  </section>
  <h2>So stimmten die deutschen Parteien</h2>
  <section class="parteien">${parteien}</section>
  ${fuss(abstimmung)}`, format);
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
  const piraten = `
    <div class="gruppe gruppe-piraten">
      <div class="gruppe-logo">${logo("PIRATEN", assets)}</div>
      <figure>
        <div class="kopf">${piratenAvatar()}${p.position ? badge(p.position, 34) : ""}</div>
        <figcaption>PIRATEN${p.quelle === "regel" ? "*" : ""}</figcaption>
      </figure>
    </div>`;

  return folien.map(({ parteien, anzahl }, i) => {
    // Startgröße; scripts/grafiken.mjs verkleinert, bis alles auf die Folie passt.
    const groesse = anzahl <= 24 ? 124 : anzahl <= 36 ? 110 : 100;
    const bloecke = parteien.map((partei) => {
      const leute = gruppen.get(partei).sort((a, b) => (a.person?.nachname ?? "").localeCompare(b.person?.nachname ?? "", "de"));
      return `
    <div class="gruppe">
      <div class="gruppe-logo">${logo(partei, assets)}</div>
      ${leute.map(({ id, position, person }) => `
        <figure>
          <div class="kopf">${gesicht(id, person, assets)}${badge(position, 34)}</div>
          <figcaption>${esc(name(person))}</figcaption>
        </figure>`).join("")}
    </div>`;
    }).join("");
    return seite(css, `
  ${kopf(abstimmung, titel, 60, assets)}
  <section class="abgeordnete" style="--gesicht:${groesse}px">${i === 0 ? piraten : ""}${bloecke}</section>
  ${fuss(abstimmung)}`, format);
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
