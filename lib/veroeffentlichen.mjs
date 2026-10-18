// Lädt die Grafiken einer Abstimmung zu Postiz hoch und legt Post (und ggf. Story) an.
import { readFile } from "node:fs/promises";
import { beitrag, story, unterstuetzt, alternativtexte } from "./beitrag.mjs";
import { postizClient } from "./postiz.mjs";
import { insZeitfenster } from "./zeitplan.mjs";

export async function postizVerbinden({ url, apiKey }) {
  const postiz = postizClient({ url, apiKey });
  const alle = await postiz.kanaele();
  const kanaele = alle.filter(unterstuetzt);
  for (const k of alle.filter((k) => !unterstuetzt(k))) console.log(`Kanal übersprungen: ${k.name} (${k.identifier}${k.disabled ? ", deaktiviert" : ""})`);
  if (!kanaele.length) throw new Error("Keine passenden Kanäle in Postiz verbunden.");
  console.log(`Kanäle: ${kanaele.map((k) => `${k.name} (${k.identifier})`).join(", ")}`);
  return { postiz, kanaele };
}

// Postiz begrenzt die Public API pro Stunde (API_LIMIT). bisher = Anfragen früherer Läufe in der letzten Stunde.
export function passtInsLimit({ postiz, kanaele }, pngs, typ, o, bisher = 0) {
  const mitStory = o.stories && typ === "schedule" && story({ titel: "" }, { kanaele, bilder: { hoch: [{}] } });
  const bedarf = pngs.feed.length + pngs.hoch.length + 1 + (mitStory ? 1 : 0);
  return bisher + postiz.anfragen + bedarf <= o.max_anfragen_pro_stunde;
}

// Zeitpunkte früherer Anfragen (daten/postiz.json) → Anzahl in der letzten Stunde.
export function anfragenLetzteStunde(zeitpunkte, jetzt = new Date()) {
  return zeitpunkte.filter((t) => jetzt.getTime() - Date.parse(t) < 60 * 60 * 1000).length;
}

// Mindestens so viele Anfragen müssen frei sein, damit sich Rendern und Verbinden lohnen
// (Kanäle abfragen + 3 Feed- und 3 Hochformat-Bilder + Post + Story).
export const MINDESTENS_FREI = 9;

// Gibt den Eintrag für daten/gepostet.json zurück.
export async function veroeffentlichen({ postiz, kanaele }, abstimmung, pngs, { datum, typ, o }) {
  const alt = alternativtexte(abstimmung, pngs.feed.length);
  const bilder = {};
  for (const format of ["feed", "hoch"]) {
    bilder[format] = [];
    for (const [i, png] of pngs[format].entries()) {
      const hochgeladen = await postiz.hochladen(await readFile(png), `${abstimmung.id}-${format}-${i + 1}.png`);
      bilder[format].push({ id: hochgeladen.id, path: hochgeladen.path, alt: alt[i] });
    }
  }

  const eintrag = { typ, zeitpunkt: datum };
  eintrag.postiz = await postiz.beitragAnlegen(beitrag(abstimmung, {
    kanaele, bilder, datum, typ, optionen: { tiktokMethode: o.tiktok_methode },
  }));
  const s = o.stories && typ === "schedule" && story(abstimmung, { kanaele, bilder, datum, typ });
  if (s) eintrag.story = await postiz.beitragAnlegen(s);
  return eintrag;
}

// Nächster freier Termin: frühestens in 10 Minuten, mindestens `abstandMinuten` nach dem letzten Post
// (auch einem schon veröffentlichten) und innerhalb des Zeitfensters, z. B. 09:00–21:00.
export function naechsterTermin(gepostet, { jetzt = new Date(), abstandMinuten = 120, zeitfenster } = {}) {
  const frueh = jetzt.getTime() + 10 * 60 * 1000;
  const posts = Object.values(gepostet).filter((g) => g.typ === "schedule").map((g) => Date.parse(g.zeitpunkt));
  const nachLetztem = posts.length ? Math.max(...posts) + abstandMinuten * 60 * 1000 : 0;
  const termin = new Date(Math.max(frueh, nachLetztem));
  return (zeitfenster ? insZeitfenster(termin, zeitfenster) : termin).toISOString();
}
