import { POSITIONEN, SYMBOLE } from "./parteien.mjs";

const ERGEBNIS = { ADOPTED: "angenommen", REJECTED: "abgelehnt" };

export function link(abstimmung) {
  return `https://howtheyvote.eu/votes/${abstimmung.id}`;
}

function datum(abstimmung) {
  const [j, m, t] = abstimmung.zeitpunkt.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

function parteienNach(abstimmung, position) {
  return abstimmung.deutschland.filter((p) => p.mehrheit === position).map((p) => p.partei);
}

function piratenZeile(abstimmung) {
  const { position, quelle } = abstimmung.piraten;
  const text = `🏴‍☠️ So hätten die PIRATEN gestimmt: ${POSITIONEN[position]}`;
  return quelle === "regel" ? `${text}*` : text;
}

function fussnote(abstimmung) {
  const p = abstimmung.piraten;
  if (p.quelle === "regel") return `* Abweichend von Markéta Gregorová (Piráti CZ): ${p.hinweis}`;
  return "Abgeleitet vom Votum der Piratin Markéta Gregorová (Piráti CZ).";
}

// Wie lang ist ein Text? Postiz zählt je Plattform anders (libraries/helpers/src/utils/count.length.ts):
// meist JavaScript-Zeichen (text.length, ein Emoji zählt 2–5), Threads in UTF-8-Bytes, X gewichtet
// (Links 23, Emojis 2) – dafür ist text.length eine sichere Obergrenze.
export const MESSEN = {
  zeichen: (text) => graphemes(text).length,
  utf16: (text) => text.length,
  bytes: (text) => new TextEncoder().encode(text).length,
};

// Langfassung, z. B. für Mastodon (500 Zeichen). Kürzt den Titel, falls nötig.
export function posttextLang(abstimmung, max = 500, messen = MESSEN.zeichen) {
  const kopf = `🇪🇺 EU-Parlament, ${datum(abstimmung)}\n`;
  const zeilen = ["", "Deutsche Parteien:"];
  for (const pos of ["FOR", "AGAINST", "ABSTENTION", "GESPALTEN"]) {
    const namen = parteienNach(abstimmung, pos);
    if (namen.length) zeilen.push(`${SYMBOLE[pos]} ${namen.join(", ")}`);
  }
  zeilen.push("", piratenZeile(abstimmung), fussnote(abstimmung), "", link(abstimmung));
  const rest = ` – ${ERGEBNIS[abstimmung.ergebnis] ?? abstimmung.ergebnis}\n` + zeilen.join("\n");
  return mitGekuerztemTitel(kopf, abstimmung.titel, rest, max, messen);
}

// Kurzfassung, z. B. für Bluesky (300 Zeichen). Kürzt den Titel, falls nötig.
export function posttextKurz(abstimmung, max = 300, messen = MESSEN.zeichen) {
  const rest = "\n" + [
    "",
    piratenZeile(abstimmung),
    abstimmung.piraten.quelle === "regel" ? "*abweichend von Gregorová" : "(Basis: M. Gregorová)",
    link(abstimmung),
  ].join("\n");
  return mitGekuerztemTitel(`🇪🇺 ${datum(abstimmung)}: `, abstimmung.titel, rest, max, messen);
}

// Kürzt den Titel (am Zeichen, mit „…“), bis kopf + titel + rest höchstens `max` lang ist.
function mitGekuerztemTitel(kopf, titel, rest, max, messen) {
  if (messen(kopf + titel + rest) <= max) return kopf + titel + rest;
  const teile = graphemes(titel);
  let n = teile.length;
  while (n > 0 && messen(kopf + teile.slice(0, n).join("").trimEnd() + "…" + rest) > max) n--;
  return kopf + teile.slice(0, n).join("").trimEnd() + "…" + rest;
}

function graphemes(text) {
  return [...new Intl.Segmenter("de", { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
}

export function zeichen(text) {
  return MESSEN.zeichen(text);
}
