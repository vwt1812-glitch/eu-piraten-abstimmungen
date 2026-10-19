// Lädt die Porträts der Abgeordneten nach cache/portraets/<id>.<jpg|png|webp>.
// Bevorzugt die Originalfotos des Europaparlaments (4:5 mit Luft über dem Kopf, <id>.jpg). Das EP liefert Skripten
// meist nur eine Bot-Abwehr (HTTP 202 ohne Inhalt) – dann lädt sie ein echter Browser (Chromium, auf dem Pi
// CHROMIUM_PATH). Ersatz: check-some-votes.eu (<id>.webp, enger aufs Gesicht zugeschnitten, oben fehlt oft etwas).
// Ein Ersatzfoto wird bei jedem Lauf gegen das EP-Original getauscht, sobald das klappt.
// Fehlende und kaputte Dateien werden (neu) geladen.
import { readFile, readdir, writeFile, mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bildformat, keinBild, imBrowserLaden, browserKennung } from "../lib/bilder.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const config = JSON.parse(await readFile(pfad("config.json"), "utf8"));
const personen = JSON.parse(await readFile(pfad("daten/abgeordnete.json"), "utf8"));
await mkdir(pfad("cache/portraets"), { recursive: true });

const KOPF = { "User-Agent": "eu-piraten-abstimmungen (+https://github.com/vwt1812-glitch/eu-piraten-abstimmungen)", Accept: "image/*" };
const EP = (id) => `https://www.europarl.europa.eu/mepphoto/${id}.jpg`;
const ERSATZ = (id) => `${config.checksomevotes.replace(/\/+$/, "")}/portraits/300/${id}.webp`;
const ENDUNG = { jpeg: "jpg", png: "png", webp: "webp" };

// Vorhandene Dateien je ID (beliebige Endung)
const vorhanden = new Map();
for (const datei of await readdir(pfad("cache/portraets"))) {
  const m = datei.match(/^(\d+)\.(jpg|png|webp)$/);
  if (m) vorhanden.set(m[1], [...(vorhanden.get(m[1]) ?? []), datei]);
}

let kaputt = 0;
const fehlerText = [];
const notieren = (text) => { if (fehlerText.length < 4) fehlerText.push(text); };
const original = new Set();   // EP-Foto vorhanden
const ersatz = new Set();     // nur check-some-votes-Foto vorhanden

for (const id of Object.keys(personen)) {
  for (const datei of vorhanden.get(id) ?? []) {
    const format = bildformat(await readFile(pfad(`cache/portraets/${datei}`)));
    const ziel = datei.endsWith(".webp") ? ersatz : original;
    if (format && !original.has(id) && !ziel.has(id)) ziel.add(id);
    else {
      if (!format) kaputt++;
      await unlink(pfad(`cache/portraets/${datei}`));
    }
  }
}

// Liegt neben einem Original noch ein Ersatzfoto, ist das überflüssig.
for (const id of [...ersatz].filter((id) => original.has(id))) {
  ersatz.delete(id);
  await unlink(pfad(`cache/portraets/${id}.webp`)).catch(() => {});
}

async function laden(url) {
  try {
    const res = await fetch(url, { headers: KOPF });
    const daten = Buffer.from(await res.arrayBuffer());
    if (res.ok && bildformat(daten)) return daten;
    notieren(`kein Bild von ${new URL(url).host} (HTTP ${res.status}, ${keinBild(daten, res.headers.get("content-type"))})`);
  } catch (e) {
    notieren(`${new URL(url).host}: ${e.message}`);
  }
  return null;
}

// EP-Original speichern und ein vorhandenes Ersatzfoto entfernen.
async function originalSpeichern(id, daten) {
  await writeFile(pfad(`cache/portraets/${id}.${ENDUNG[bildformat(daten)]}`), daten);
  if (ersatz.delete(id)) await unlink(pfad(`cache/portraets/${id}.webp`)).catch(() => {});
  original.add(id);
}

// 1. EP direkt – klappt selten, kostet aber kaum Zeit.
let direkt = 0, imBrowser = 0, perErsatz = 0;
let ohneOriginal = Object.keys(personen).filter((id) => !original.has(id));
for (const id of ohneOriginal) {
  const daten = await laden(EP(id));
  if (daten) { await originalSpeichern(id, daten); direkt++; }
  await new Promise((r) => setTimeout(r, 150));
}

// 2. EP über den Browser.
ohneOriginal = ohneOriginal.filter((id) => !original.has(id));
if (ohneOriginal.length) {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const kontext = await browser.newContext({ userAgent: browserKennung(browser.version()), locale: "de-DE" });
    let fehlversuche = 0;
    for (const id of ohneOriginal) {
      // Klappt es dreimal nicht (und noch nie), ist die Seite gesperrt – nicht jedes Foto 30 s abwarten.
      if (!imBrowser && fehlversuche >= 3) { fehlerText.push("Browser: drei Fehlversuche, Rest übersprungen"); break; }
      const daten = await imBrowserLaden(kontext, EP(id));
      if (!daten) { fehlversuche++; continue; }
      await originalSpeichern(id, daten);
      imBrowser++;
    }
  } catch (e) {
    fehlerText.push(`Browser: ${e.message.split("\n")[0]}`);
  } finally {
    await browser?.close();
  }
}

// 3. Ersatz von check-some-votes für alle ohne jedes Foto.
const fehlend = [];
for (const id of Object.keys(personen).filter((id) => !original.has(id) && !ersatz.has(id))) {
  const daten = await laden(ERSATZ(id));
  if (daten) {
    await writeFile(pfad(`cache/portraets/${id}.webp`), daten);
    ersatz.add(id);
    perErsatz++;
  } else fehlend.push(id);
}

const fehler = fehlend.length;
const neu = direkt + imBrowser + perErsatz;
for (const t of fehlerText) console.warn(t);
if (fehler) {
  const namen = fehlend.slice(0, 10).map((id) => `${personen[id]?.nachname ?? "?"} (${id})`).join(", ");
  console.warn(`Ohne Foto (es erscheinen Initialen): ${namen}${fehler > 10 ? ` und ${fehler - 10} weitere` : ""}`);
}
console.log(`Porträts: ${original.size} EP-Originale (${direkt + imBrowser} neu, davon ${imBrowser} über den Browser), ` +
  `${ersatz.size} Ersatzfotos von check-some-votes${perErsatz ? ` (${perErsatz} neu)` : ""}` +
  `${kaputt ? `, ${kaputt} kaputte entfernt` : ""}${fehler ? `, ${fehler} ohne Bild` : ""}`);
if (fehler && !original.size && !ersatz.size) process.exitCode = 1;
