// Lädt die Porträts der Abgeordneten vom Europaparlament nach cache/portraets/.
// Fehlende und kaputte Dateien (z. B. eine gespeicherte Fehlerseite) werden (neu) geladen.
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bildformat, keinBild } from "../lib/bilder.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const personen = JSON.parse(await readFile(pfad("daten/abgeordnete.json"), "utf8"));
await mkdir(pfad("cache/portraets"), { recursive: true });

// Ohne User-Agent liefert die Website des EP womöglich kein Bild (so macht es auch check-some-votes).
const KOPF = { "User-Agent": "eu-piraten-abstimmungen (+https://github.com/vwt1812-glitch/eu-piraten-abstimmungen)", Accept: "image/*" };

let neu = 0, ok = 0, kaputt = 0, fehler = 0;
for (const id of Object.keys(personen)) {
  const ziel = pfad(`cache/portraets/${id}.jpg`);
  const vorhanden = await readFile(ziel).catch(() => null);
  if (vorhanden && bildformat(vorhanden)) { ok++; continue; }
  if (vorhanden) { kaputt++; await unlink(ziel); }

  try {
    const res = await fetch(`https://www.europarl.europa.eu/mepphoto/${id}.jpg`, { headers: KOPF });
    const daten = Buffer.from(await res.arrayBuffer());
    if (!res.ok || !bildformat(daten)) {
      fehler++;
      // Nur die ersten Fälle ausführlich – reicht zur Diagnose.
      if (fehler <= 3) console.warn(`${id}: kein Bild (HTTP ${res.status}, ${keinBild(daten, res.headers.get("content-type"))})`);
      continue;
    }
    await writeFile(ziel, daten);
    neu++;
  } catch (e) {
    fehler++;
    if (fehler <= 3) console.warn(`${id}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 150));
}
console.log(`Porträts: ${ok} vorhanden, ${neu} neu geladen${kaputt ? `, ${kaputt} kaputte ersetzt` : ""}${fehler ? `, ${fehler} ohne Bild` : ""}`);
if (fehler && !neu && !ok) process.exitCode = 1;
