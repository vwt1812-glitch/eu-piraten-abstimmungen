// Holt deutsche Titel von check-some-votes.eu für die Abstimmungen der letzten Wochen nach data/titel_auto.json.
// Von Hand gepflegte Titel in data/titel.json haben immer Vorrang.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { titelZuordnen, abstimmungenLaden } from "../lib/titel.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const json = async (p, standard) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => JSON.stringify(standard)));

const config = await json("config.json");
const { abstimmungen } = await json("data/abstimmungen.json");
const auto = await json("data/titel_auto.json", {});

// Nur was gepostet werden könnte: nicht älter als die Posting-Grenze, noch ohne Titel.
const tage = config.posten.max_alter_tage;
const grenze = new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const offen = abstimmungen.filter((a) => a.zeitpunkt.slice(0, 10) >= grenze && !auto[a.id]);
console.log(`${offen.length} Abstimmungen seit ${grenze} ohne automatischen Titel`);
if (!offen.length) process.exit(0);

const von = offen.at(-1).zeitpunkt.slice(0, 10);
const bis = offen[0].zeitpunkt.slice(0, 10);
const basis = config.checksomevotes;
const [deutsch, englisch] = await Promise.all([
  abstimmungenLaden({ basis, lang: "de", von, bis }),
  abstimmungenLaden({ basis, lang: "en", von, bis }),
]);
console.log(`check-some-votes: ${deutsch.length} Abstimmungen ${von} bis ${bis}`);

const neu = titelZuordnen(offen, deutsch, englisch);
for (const [id, titel] of Object.entries(neu)) console.log(`  ${id}: ${titel}`);
console.log(`${Object.keys(neu).length} neue Titel, ${offen.length - Object.keys(neu).length} ohne Zuordnung`);

const sortiert = Object.fromEntries(Object.entries({ ...auto, ...neu }).sort(([a], [b]) => Number(b) - Number(a)));
await writeFile(pfad("data/titel_auto.json"), JSON.stringify(sortiert, null, 1) + "\n");
