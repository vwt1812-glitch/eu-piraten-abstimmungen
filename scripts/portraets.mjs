// Lädt die Porträts der Abgeordneten vom Europaparlament nach cache/portraets/ (nur fehlende).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const personen = JSON.parse(await readFile(pfad("daten/abgeordnete.json"), "utf8"));
await mkdir(pfad("cache/portraets"), { recursive: true });

let neu = 0;
for (const id of Object.keys(personen)) {
  const ziel = pfad(`cache/portraets/${id}.jpg`);
  if (existsSync(ziel)) continue;
  const res = await fetch(`https://www.europarl.europa.eu/mepphoto/${id}.jpg`);
  if (!res.ok) { console.warn(`${id}: HTTP ${res.status}`); continue; }
  await writeFile(ziel, Buffer.from(await res.arrayBuffer()));
  neu++;
}
console.log(`${neu} Porträts geladen`);
