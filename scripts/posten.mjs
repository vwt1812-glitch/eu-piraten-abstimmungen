// Plant neue Abstimmungen in Postiz ein: npm run posten   (ohne POSTIZ_URL/POSTIZ_API_KEY oder mit --trocken nur Vorschau)
//
// - status „automatisch“ → geplanter Post auf allen verbundenen Kanälen (Limits aus config.json → posten)
// - status „pruefen“     → Entwurf in Postiz, ein Mensch entscheidet dort
// - ohne deutschen Titel (data/titel.json oder automatisch data/titel_auto.json) wird nichts gepostet
// Bereits Gepostetes steht in data/gepostet.json und wird nie doppelt angelegt.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auswahl } from "../lib/auswahl.mjs";
import { beitrag, story, unterstuetzt, alternativtexte } from "../lib/beitrag.mjs";
import { postizClient } from "../lib/postiz.mjs";
import { grafikenRendern, mitDeutschemTitel, deutscheTitel } from "../lib/render.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const json = async (p, standard) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => JSON.stringify(standard)));

const config = await json("config.json");
const { abstimmungen } = await json("data/abstimmungen.json");
const personen = await json("data/abgeordnete.json");
const gepostet = await json("data/gepostet.json", {});
const o = config.posten;

const { POSTIZ_URL, POSTIZ_API_KEY } = process.env;
const trocken = process.argv.includes("--trocken") || !POSTIZ_URL || !POSTIZ_API_KEY;

const titel = await deutscheTitel();
const { posten, entwuerfe, ohneTitel } = auswahl(abstimmungen, gepostet, {
  proTag: o.pro_tag, proWoche: o.pro_woche, maxAlterTage: o.max_alter_tage,
  hatTitel: (a) => Boolean(titel[a.id]),
});
if (ohneTitel.length) {
  console.log(`\n${ohneTitel.length} Abstimmungen ohne deutschen Titel (check-some-votes.eu hatte keinen) – bei Bedarf in data/titel.json eintragen:`);
  for (const a of ohneTitel) console.log(`  "${a.id}": "",   // ${a.zeitpunkt.slice(0, 10)} ${a.titel}`);
  console.log();
}
const liste = [
  ...posten.map((a) => ({ a, typ: "schedule" })),
  ...entwuerfe.map((a) => ({ a, typ: "draft" })),
];
console.log(`${posten.length} zu posten, ${entwuerfe.length} als Entwurf zur Prüfung`);
if (!liste.length) process.exit(0);

const mitTitel = new Map((await mitDeutschemTitel(liste.map((l) => l.a))).map((a) => [a.id, a]));

if (trocken) {
  console.log("Trockenlauf – es wird nichts an Postiz geschickt.");
  const kanaele = ["x", "bluesky", "mastodon", "instagram", "facebook", "tiktok"].map((identifier) => ({ id: identifier, identifier }));
  for (const { a, typ } of liste) {
    const b = beitrag(mitTitel.get(a.id), { kanaele, bilder: { feed: [], hoch: [] }, datum: new Date().toISOString(), typ });
    console.log(`\n── ${a.id} (${typ}) ${mitTitel.get(a.id).titel}`);
    for (const p of b.posts) console.log(`  ${p.integration.id}: ${p.value[0].content.replace(/<\/p><p>/g, "\n").replace(/<[^>]+>/g, "").length} Zeichen`);
  }
  process.exit(0);
}

const postiz = postizClient({ url: POSTIZ_URL, apiKey: POSTIZ_API_KEY });
const alle = await postiz.kanaele();
const kanaele = alle.filter(unterstuetzt);
for (const k of alle.filter((k) => !unterstuetzt(k))) console.log(`Kanal übersprungen: ${k.name} (${k.identifier}${k.disabled ? ", deaktiviert" : ""})`);
if (!kanaele.length) throw new Error("Keine passenden Kanäle in Postiz verbunden.");
console.log(`Kanäle: ${kanaele.map((k) => `${k.name} (${k.identifier})`).join(", ")}`);

const grafiken = await grafikenRendern([...mitTitel.values()], personen);

let geplant = 0;
for (const { a, typ } of liste) {
  const abstimmung = mitTitel.get(a.id);
  const pngs = grafiken[a.id];
  const mitStory = o.stories && typ === "schedule" && story(abstimmung, { kanaele, bilder: { hoch: [{}] } });

  // Uploads (beide Formate) + Post + ggf. Story müssen ins Stundenlimit von Postiz passen.
  const bedarf = pngs.feed.length + pngs.hoch.length + 1 + (mitStory ? 1 : 0);
  if (postiz.anfragen + bedarf > o.max_anfragen_pro_lauf) {
    console.log(`Anfragen-Limit erreicht (${postiz.anfragen}/${o.max_anfragen_pro_lauf}) – Rest beim nächsten Lauf.`);
    break;
  }

  const alt = alternativtexte(abstimmung, pngs.feed.length);
  const bilder = {};
  for (const format of ["feed", "hoch"]) {
    bilder[format] = [];
    for (const [i, png] of pngs[format].entries()) {
      const hochgeladen = await postiz.hochladen(await readFile(png), `${a.id}-${format}-${i + 1}.png`);
      bilder[format].push({ id: hochgeladen.id, path: hochgeladen.path, alt: alt[i] });
    }
  }

  // Posts im Abstand von config.posten.abstand_minuten; Entwürfe einen Tag später (Postiz braucht ein Datum).
  const minuten = typ === "schedule" ? 10 + geplant++ * o.abstand_minuten : 24 * 60;
  const datum = new Date(Date.now() + minuten * 60 * 1000).toISOString();

  const antwort = await postiz.beitragAnlegen(beitrag(abstimmung, {
    kanaele, bilder, datum, typ, optionen: { tiktokMethode: o.tiktok_methode },
  }));
  gepostet[a.id] = { typ, zeitpunkt: datum, postiz: antwort };
  // Nach jedem Post speichern, damit ein Abbruch nichts doppelt postet.
  await writeFile(pfad("data/gepostet.json"), JSON.stringify(gepostet, null, 1) + "\n");
  console.log(`${typ === "schedule" ? "Geplant" : "Entwurf"}: ${a.id} ${abstimmung.titel} (${datum})`);

  if (mitStory) {
    const s = await postiz.beitragAnlegen(story(abstimmung, { kanaele, bilder, datum, typ }));
    gepostet[a.id].story = s;
    await writeFile(pfad("data/gepostet.json"), JSON.stringify(gepostet, null, 1) + "\n");
    console.log(`  + Story`);
  }
}
