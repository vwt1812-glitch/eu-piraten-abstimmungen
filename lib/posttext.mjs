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
  const text = `🏴‍☠️ So hätten die Piraten gestimmt: ${POSITIONEN[position]}`;
  return quelle === "regel" ? `${text}*` : text;
}

function fussnote(abstimmung) {
  const p = abstimmung.piraten;
  if (p.quelle === "regel") return `* Abweichend von Markéta Gregorová (Piráti CZ): ${p.hinweis}`;
  return "Abgeleitet vom Votum der Piratin Markéta Gregorová (Piráti CZ).";
}

// Langfassung, z. B. für Mastodon (500 Zeichen). Kürzt den Titel, falls nötig.
export function posttextLang(abstimmung, max = 500) {
  const kopf = `🇪🇺 EU-Parlament, ${datum(abstimmung)}\n`;
  const zeilen = ["", "Deutsche Parteien:"];
  for (const pos of ["FOR", "AGAINST", "ABSTENTION", "GESPALTEN"]) {
    const namen = parteienNach(abstimmung, pos);
    if (namen.length) zeilen.push(`${SYMBOLE[pos]} ${namen.join(", ")}`);
  }
  zeilen.push("", piratenZeile(abstimmung), fussnote(abstimmung), "", link(abstimmung));
  const rest = ` – ${ERGEBNIS[abstimmung.ergebnis] ?? abstimmung.ergebnis}\n` + zeilen.join("\n");
  return kopf + kuerzen(abstimmung.titel, max - zeichen(kopf) - zeichen(rest)) + rest;
}

// Kurzfassung, z. B. für Bluesky (300 Zeichen). Kürzt den Titel, falls nötig.
export function posttextKurz(abstimmung, max = 300) {
  const rest = [
    "",
    piratenZeile(abstimmung),
    abstimmung.piraten.quelle === "regel" ? "*abweichend von Gregorová" : "(Basis: M. Gregorová)",
    link(abstimmung),
  ].join("\n");
  const kopf = `🇪🇺 ${datum(abstimmung)}: `;
  const frei = max - zeichen(kopf) - zeichen(rest) - 1; // 1 = Zeilenumbruch nach dem Titel
  return kopf + kuerzen(abstimmung.titel, frei) + "\n" + rest;
}

function kuerzen(titel, frei) {
  if (zeichen(titel) <= frei) return titel;
  return graphemes(titel).slice(0, frei - 1).join("").trimEnd() + "…";
}

function graphemes(text) {
  return [...new Intl.Segmenter("de", { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
}

export function zeichen(text) {
  return graphemes(text).length;
}
