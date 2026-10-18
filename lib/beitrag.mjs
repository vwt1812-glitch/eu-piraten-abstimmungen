// Baut aus einer Abstimmung den Postiz-Beitrag für alle verbundenen Kanäle.
import { posttextLang, posttextKurz } from "./posttext.mjs";

// Kanäle, die wir bedienen, mit Textlänge und plattformspezifischen Einstellungen.
// Schlüssel = Postiz-„identifier“ des Kanals.
const KANAELE = {
  "x": { text: (a) => posttextKurz(a, 280), einstellungen: () => ({ who_can_reply_post: "everyone", post_type: "post" }) },
  "bluesky": { text: (a) => posttextKurz(a, 300) },
  "mastodon": { text: (a) => posttextLang(a, 500) },
  "threads": { text: (a) => posttextLang(a, 500) },
  "telegram": { text: (a) => posttextLang(a, 4000) },
  "facebook": { text: (a) => posttextLang(a, 4000) },
  "instagram": { text: (a) => posttextLang(a, 2200), einstellungen: () => ({ post_type: "post", collaborators: [] }) },
  "instagram-standalone": { text: (a) => posttextLang(a, 2200), einstellungen: () => ({ post_type: "post", collaborators: [] }) },
  "tiktok": { text: (a) => posttextLang(a, 2200), einstellungen: tiktok },
  "tiktok-business": { text: (a) => posttextLang(a, 2200), einstellungen: tiktok },
};

function tiktok(a, optionen) {
  return {
    title: [...a.titel].slice(0, 90).join(""),
    privacy_level: "PUBLIC_TO_EVERYONE",
    duet: false,
    stitch: false,
    comment: true,
    autoAddMusic: "no",
    brand_content_toggle: false,
    video_made_with_ai: false,
    brand_organic_toggle: false,
    content_posting_method: optionen.tiktokMethode ?? "DIRECT_POST",
  };
}

export function unterstuetzt(kanal) {
  return !kanal.disabled && Object.hasOwn(KANAELE, kanal.identifier);
}

// Postiz speichert Posts als HTML; jede Zeile als eigener Absatz ergibt auf allen Plattformen Zeilenumbrüche.
export function alsHtml(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text.split("\n").map((zeile) => `<p>${esc(zeile)}</p>`).join("");
}

// bilder: [{ id, path }] aus dem Upload, in Karussell-Reihenfolge
export function beitrag(abstimmung, { kanaele, bilder, datum, typ = "schedule", optionen = {} }) {
  return {
    type: typ,
    date: datum,
    shortLink: false,
    tags: [],
    posts: kanaele.filter(unterstuetzt).map((kanal) => {
      const k = KANAELE[kanal.identifier];
      return {
        integration: { id: kanal.id },
        value: [{ content: alsHtml(k.text(abstimmung)), image: bilder }],
        settings: { __type: kanal.identifier, ...(k.einstellungen?.(abstimmung, optionen) ?? {}) },
      };
    }),
  };
}

// Alternativtexte für die Bilder (Barrierefreiheit, v. a. Mastodon/Bluesky).
export function alternativtexte(abstimmung, anzahl) {
  const pos = { FOR: "dafür", AGAINST: "dagegen", ABSTENTION: "Enthaltung" }[abstimmung.piraten.position] ?? "–";
  const parteien = abstimmung.deutschland
    .map((p) => `${p.partei}: ${{ FOR: "dafür", AGAINST: "dagegen", ABSTENTION: "Enthaltung", GESPALTEN: "gespalten", DID_NOT_VOTE: "nicht abgestimmt" }[p.mehrheit]}`)
    .join(", ");
  const texte = [`Grafik „${abstimmung.titel}“. So hätten die PIRATEN gestimmt: ${pos}. Deutsche Parteien – ${parteien}.`];
  for (let i = 1; i < anzahl; i++) texte.push(`Grafik „${abstimmung.titel}“: Fotos aller deutschen Abgeordneten mit ihrem Votum, Teil ${i} von ${anzahl - 1}.`);
  return texte;
}
