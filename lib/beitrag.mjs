// Baut aus einer Abstimmung den Postiz-Beitrag für alle verbundenen Kanäle.
import { posttextLang, posttextKurz, MESSEN } from "./posttext.mjs";
import { verteilungWorte } from "./grafik.mjs";

// Kanäle, die wir bedienen, mit Textlänge, Bildformat und plattformspezifischen Einstellungen.
// Schlüssel = Postiz-„identifier“ des Kanals. format: "feed" (4:5, Standard) oder "hoch" (9:16).
// Längen und Zählweise wie in Postiz (maxLength der Provider, count.length.ts).
const { utf16, bytes } = MESSEN;
const KANAELE = {
  "x": { text: (a) => posttextKurz(a, 280, utf16), einstellungen: () => ({ who_can_reply_post: "everyone", post_type: "post" }) },
  "bluesky": { text: (a) => posttextKurz(a, 300, utf16) },
  "mastodon": { text: (a) => posttextLang(a, 500, utf16) },
  // Threads zählt Bytes: die Langfassung wäre mit Umlauten und Emojis fast immer zu lang.
  "threads": { text: (a) => posttextKurz(a, 500, bytes) },
  "telegram": { text: (a) => posttextLang(a, 4096, utf16) },
  "facebook": { text: (a) => posttextLang(a, 63206, utf16) },
  "instagram": { text: (a) => posttextLang(a, 2200, utf16), einstellungen: () => ({ post_type: "post", collaborators: [] }) },
  "instagram-standalone": { text: (a) => posttextLang(a, 2200, utf16), einstellungen: () => ({ post_type: "post", collaborators: [] }) },
  "tiktok": { text: (a) => posttextLang(a, 2000, utf16), format: "hoch", einstellungen: tiktok },
  "tiktok-business": { text: (a) => posttextLang(a, 2000, utf16), format: "hoch", einstellungen: tiktok },
};

// Höchstlängen je Kanal – für Tests und Prüfungen.
export const MAX_LAENGE = { x: 280, bluesky: 300, mastodon: 500, threads: 500, telegram: 4096, facebook: 63206, instagram: 2200, "instagram-standalone": 2200, tiktok: 2000, "tiktok-business": 2000 };

// Kanäle mit Stories; die Story zeigt die Übersicht im Hochformat.
const STORIES = {
  "instagram": { post_type: "story", collaborators: [] },
  "instagram-standalone": { post_type: "story", collaborators: [] },
  "facebook": { post_type: "story" },
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

// bilder: { feed: [{ id, path, alt }], hoch: [...] } aus dem Upload, in Karussell-Reihenfolge
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
        value: [{ content: alsHtml(k.text(abstimmung)), image: bilder[k.format ?? "feed"] }],
        settings: { __type: kanal.identifier, ...(k.einstellungen?.(abstimmung, optionen) ?? {}) },
      };
    }),
  };
}

// Story mit der Übersicht im Hochformat für Instagram und Facebook; null, wenn kein solcher Kanal verbunden ist.
export function story(abstimmung, { kanaele, bilder, datum, typ = "schedule" }) {
  const passend = kanaele.filter((k) => unterstuetzt(k) && Object.hasOwn(STORIES, k.identifier));
  if (!passend.length) return null;
  return {
    type: typ,
    date: datum,
    shortLink: false,
    tags: [],
    posts: passend.map((kanal) => ({
      integration: { id: kanal.id },
      value: [{ content: alsHtml(abstimmung.titel), image: [bilder.hoch[0]] }],
      settings: { __type: kanal.identifier, ...STORIES[kanal.identifier] },
    })),
  };
}

// Alternativtexte für die Bilder (Barrierefreiheit, v. a. Mastodon/Bluesky).
export function alternativtexte(abstimmung, anzahl) {
  const pos = { FOR: "dafür", AGAINST: "dagegen", ABSTENTION: "Enthaltung" }[abstimmung.piraten.position] ?? "–";
  const parteien = abstimmung.deutschland
    .map((p) => {
      const mehrheit = { FOR: "dafür", AGAINST: "dagegen", ABSTENTION: "Enthaltung", GESPALTEN: "gespalten", DID_NOT_VOTE: "nicht abgestimmt" }[p.mehrheit];
      const zahlen = verteilungWorte(p);
      return `${p.partei}: ${mehrheit}${zahlen ? ` (${zahlen})` : ""}`;
    })
    .join("; ");
  const texte = [`Grafik „${abstimmung.titel}“. So hätten die PIRATEN gestimmt: ${pos}. Deutsche Parteien – ${parteien}.`];
  for (let i = 1; i < anzahl; i++) texte.push(`Grafik „${abstimmung.titel}“: Fotos aller deutschen Abgeordneten mit ihrem Votum, Teil ${i} von ${anzahl - 1}.`);
  return texte;
}
