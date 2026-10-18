// Lädt die Grafiken einer Abstimmung zu Postiz hoch und legt Post (und ggf. Story) an.
import { readFile } from "node:fs/promises";
import { beitrag, story, unterstuetzt, alternativtexte } from "./beitrag.mjs";
import { postizClient } from "./postiz.mjs";

export async function postizVerbinden({ url, apiKey }) {
  const postiz = postizClient({ url, apiKey });
  const alle = await postiz.kanaele();
  const kanaele = alle.filter(unterstuetzt);
  for (const k of alle.filter((k) => !unterstuetzt(k))) console.log(`Kanal übersprungen: ${k.name} (${k.identifier}${k.disabled ? ", deaktiviert" : ""})`);
  if (!kanaele.length) throw new Error("Keine passenden Kanäle in Postiz verbunden.");
  console.log(`Kanäle: ${kanaele.map((k) => `${k.name} (${k.identifier})`).join(", ")}`);
  return { postiz, kanaele };
}

// Passt die Abstimmung noch ins Stundenlimit von Postiz? (Uploads beider Formate + Post + ggf. Story)
export function passtInsLimit({ postiz, kanaele }, pngs, typ, o) {
  const mitStory = o.stories && typ === "schedule" && story({ titel: "" }, { kanaele, bilder: { hoch: [{}] } });
  const bedarf = pngs.feed.length + pngs.hoch.length + 1 + (mitStory ? 1 : 0);
  return postiz.anfragen + bedarf <= o.max_anfragen_pro_lauf;
}

// Gibt den Eintrag für data/gepostet.json zurück.
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

// Nächster freier Termin: frühestens in 10 Minuten, sonst nach dem zuletzt geplanten Post plus Abstand.
export function naechsterTermin(gepostet, { jetzt = new Date(), abstandMinuten = 120 } = {}) {
  const frueh = jetzt.getTime() + 10 * 60 * 1000;
  const geplant = Object.values(gepostet)
    .filter((g) => g.typ === "schedule")
    .map((g) => Date.parse(g.zeitpunkt))
    .filter((t) => t > jetzt.getTime());
  const letzter = geplant.length ? Math.max(...geplant) + abstandMinuten * 60 * 1000 : 0;
  return new Date(Math.max(frueh, letzter)).toISOString();
}
