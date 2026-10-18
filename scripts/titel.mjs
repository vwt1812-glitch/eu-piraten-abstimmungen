// Holt von check-some-votes.eu für die Abstimmungen der letzten Wochen
// - deutsche Titel → daten/titel_auto.json (von Hand gepflegte Titel in titel.json haben Vorrang),
// - deutsche KI-Zusammenfassungen → daten/zusammenfassungen.json ({ punkte: [...] } oder punkte: null).
// Abstimmungen ohne Zusammenfassung werden täglich erneut gefragt – die Berichte kommen oft erst später.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { zuordnen, titelZuordnen, abstimmungenLaden, zusammenfassungLaden } from "../lib/titel.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const json = async (p, standard) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => JSON.stringify(standard)));
const sortiert = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => Number(b) - Number(a)));
const TAG = 24 * 60 * 60 * 1000;

await mkdir(pfad("daten"), { recursive: true });
const config = await json("config.json");
const { abstimmungen } = await json("daten/abstimmungen.json");
const auto = await json("daten/titel_auto.json", {});
const zusammenfassungen = await json("daten/zusammenfassungen.json", {});

// Nur was gepostet werden könnte: nicht älter als die Posting-Grenze.
const grenze = new Date(Date.now() - config.posten.max_alter_tage * TAG).toISOString().slice(0, 10);
const neueste = abstimmungen.filter((a) => a.zeitpunkt.slice(0, 10) >= grenze);
const zusammenfassungFehlt = (id) => {
  const z = zusammenfassungen[id];
  return !z || (z.punkte === null && Date.now() - Date.parse(z.abgerufen) > TAG);
};
const offen = neueste.filter((a) => !auto[a.id] || zusammenfassungFehlt(a.id));
console.log(`${offen.length} Abstimmungen seit ${grenze} ohne Titel oder Zusammenfassung`);
if (!offen.length) process.exit(0);

const von = neueste.at(-1).zeitpunkt.slice(0, 10);
const bis = neueste[0].zeitpunkt.slice(0, 10);
const basis = config.checksomevotes;
const [deutsch, englisch] = await Promise.all([
  abstimmungenLaden({ basis, lang: "de", von, bis }),
  abstimmungenLaden({ basis, lang: "en", von, bis }),
]);
console.log(`check-some-votes: ${deutsch.length} Abstimmungen ${von} bis ${bis}`);

// Titel
const ohneTitel = new Set(neueste.filter((a) => !auto[a.id]).map((a) => a.id));
const neu = Object.fromEntries(Object.entries(titelZuordnen(neueste, deutsch, englisch)).filter(([id]) => ohneTitel.has(Number(id))));
for (const [id, titel] of Object.entries(neu)) console.log(`  Titel ${id}: ${titel}`);
console.log(`${Object.keys(neu).length} neue Titel`);
await writeFile(pfad("daten/titel_auto.json"), JSON.stringify(sortiert({ ...auto, ...neu }), null, 1) + "\n");

// Zusammenfassungen – nacheinander und mit kleiner Pause, die API begrenzt Anfragen.
const zuordnung = zuordnen(neueste, deutsch);
let gefunden = 0;
for (const a of neueste.filter((a) => zusammenfassungFehlt(a.id) && zuordnung.has(a.id))) {
  try {
    const punkte = await zusammenfassungLaden({ basis, csvId: zuordnung.get(a.id).id });
    zusammenfassungen[a.id] = { punkte, abgerufen: new Date().toISOString() };
    if (punkte) gefunden++;
  } catch (e) {
    console.warn(`  Zusammenfassung ${a.id}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`${gefunden} neue Zusammenfassungen`);
await writeFile(pfad("daten/zusammenfassungen.json"), JSON.stringify(sortiert(zusammenfassungen), null, 1) + "\n");
