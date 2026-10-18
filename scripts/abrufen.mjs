// Lädt die benötigten Tabellen von HowTheyVote.eu nach cache/.
import { mkdir, writeFile, readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../config.json", import.meta.url)));
const ziel = new URL("../cache/", import.meta.url);

export const TABELLEN = [
  "votes",
  "member_votes",
  "oeil_subjects",
  "oeil_subject_votes",
  "eurovoc_concepts",
  "eurovoc_concept_votes",
];

await mkdir(ziel, { recursive: true });

const stand = await fetch(config.quelle + "last_updated.txt");
if (!stand.ok) throw new Error(`last_updated.txt: HTTP ${stand.status}`);
const zeitpunkt = (await stand.text()).trim();
console.log(`Export vom ${zeitpunkt}`);

for (const name of TABELLEN) {
  const res = await fetch(config.quelle + name + ".csv.gz");
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const daten = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(name + ".csv.gz", ziel), daten);
  console.log(`${name}: ${(daten.length / 1e6).toFixed(1)} MB`);
}
await writeFile(new URL("last_updated.txt", ziel), zeitpunkt + "\n");
