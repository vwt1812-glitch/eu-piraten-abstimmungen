// Lädt die Porträts der Abgeordneten nach cache/portraets/<id>.<jpg|png|webp>.
// Quellen der Reihe nach: check-some-votes.eu (verkleinerte Kopien der EP-Fotos), dann das Europaparlament.
// Das EP liefert Skripten oft nur eine Bot-Abwehr (HTTP 202 ohne Inhalt) – deshalb zuerst check-some-votes.
// Fehlende und kaputte Dateien werden (neu) geladen.
import { readFile, readdir, writeFile, mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bildformat, keinBild } from "../lib/bilder.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const config = JSON.parse(await readFile(pfad("config.json"), "utf8"));
const personen = JSON.parse(await readFile(pfad("daten/abgeordnete.json"), "utf8"));
await mkdir(pfad("cache/portraets"), { recursive: true });

const KOPF = { "User-Agent": "eu-piraten-abstimmungen (+https://github.com/vwt1812-glitch/eu-piraten-abstimmungen)", Accept: "image/*" };
const QUELLEN = [
  (id) => `${config.checksomevotes.replace(/\/+$/, "")}/portraits/300/${id}.webp`,
  (id) => `https://www.europarl.europa.eu/mepphoto/${id}.jpg`,
];
const ENDUNG = { jpeg: "jpg", png: "png", webp: "webp" };

// Vorhandene Dateien je ID (beliebige Endung)
const vorhanden = new Map();
for (const datei of await readdir(pfad("cache/portraets"))) {
  const m = datei.match(/^(\d+)\.(jpg|png|webp)$/);
  if (m) vorhanden.set(m[1], [...(vorhanden.get(m[1]) ?? []), datei]);
}

let neu = 0, ok = 0, kaputt = 0, fehler = 0;
const fehlerText = [];
for (const id of Object.keys(personen)) {
  let gut = false;
  for (const datei of vorhanden.get(id) ?? []) {
    if (!gut && bildformat(await readFile(pfad(`cache/portraets/${datei}`)))) gut = true;
    else { kaputt++; await unlink(pfad(`cache/portraets/${datei}`)); }
  }
  if (gut) { ok++; continue; }

  let geladen = false;
  for (const quelle of QUELLEN) {
    const url = quelle(id);
    try {
      const res = await fetch(url, { headers: KOPF });
      const daten = Buffer.from(await res.arrayBuffer());
      const format = res.ok && bildformat(daten);
      if (format) {
        await writeFile(pfad(`cache/portraets/${id}.${ENDUNG[format]}`), daten);
        geladen = true;
        break;
      }
      if (fehlerText.length < 4) fehlerText.push(`${id}: kein Bild von ${new URL(url).host} (HTTP ${res.status}, ${keinBild(daten, res.headers.get("content-type"))})`);
    } catch (e) {
      if (fehlerText.length < 4) fehlerText.push(`${id}: ${new URL(url).host}: ${e.message}`);
    }
  }
  geladen ? neu++ : fehler++;
  await new Promise((r) => setTimeout(r, 150));
}
for (const t of fehlerText) console.warn(t);
console.log(`Porträts: ${ok} vorhanden, ${neu} neu geladen${kaputt ? `, ${kaputt} kaputte entfernt` : ""}${fehler ? `, ${fehler} ohne Bild` : ""}`);
if (fehler && !neu && !ok) process.exitCode = 1;
