// Rendert die Sharepics: npm run grafiken -- [Abstimmungs-ID …]   (ohne IDs: die 3 neuesten mit Piraten-Position)
// Ergebnis: out/<id>/1-uebersicht.png, out/<id>/2-abgeordnete.png, 3-abgeordnete.png …
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { uebersichtHtml, abgeordneteFolien, FORMATE } from "../lib/grafik.mjs";

const wurzel = new URL("../", import.meta.url);
const pfad = (p) => fileURLToPath(new URL(p, wurzel));
const json = async (p) => JSON.parse(await readFile(pfad(p), "utf8"));

const { abstimmungen } = await json("data/abstimmungen.json");
const personen = await json("data/abgeordnete.json");
const titelDe = existsSync(pfad("data/titel.json")) ? await json("data/titel.json") : {};

const ids = process.argv.slice(2).map(Number);
const auswahl = ids.length
  ? ids.map((id) => abstimmungen.find((a) => a.id === id) ?? (() => { throw new Error(`Abstimmung ${id} fehlt`); })())
  : abstimmungen.filter((a) => a.piraten.position).slice(0, 3);

// Schriften aus @fontsource, Logos aus assets/logos/, Porträts aus cache/portraets/.
const fonts = ["oswald/500", "oswald/600", "oswald/700", "inter/400", "inter/600", "inter/700"]
  .map((f) => `@import url("${pathToFileURL(pfad(`node_modules/@fontsource/${f}.css`))}");`).join("\n");
const css = fonts + "\n" + (await readFile(pfad("assets/grafik.css"), "utf8"));

const logos = {};
for (const datei of await readdir(pfad("assets/logos")).catch(() => [])) {
  const m = datei.match(/^(.+)\.(svg|png|webp|jpg)$/);
  if (m) logos[m[1]] = pathToFileURL(pfad(`assets/logos/${datei}`)).href;
}
const portraets = {};
for (const datei of await readdir(pfad("cache/portraets")).catch(() => [])) {
  const m = datei.match(/^(\d+)\.jpg$/);
  if (m) portraets[m[1]] = pathToFileURL(pfad(`cache/portraets/${datei}`)).href;
}
const assets = { logos, portraets };

// Verkleinert die Gesichter in 2-px-Schritten, bis der Bereich nicht mehr überläuft.
async function gesichterEinpassen(page) {
  const groesse = await page.evaluate(() => {
    const bereich = document.querySelector(".abgeordnete");
    if (!bereich) return null;
    let px = parseInt(bereich.style.getPropertyValue("--gesicht"), 10);
    while (px > 40 && bereich.scrollHeight > bereich.clientHeight) {
      px -= 2;
      bereich.style.setProperty("--gesicht", `${px}px`);
    }
    return px;
  });
  if (groesse !== null && groesse <= 40) console.warn("Warnung: Gesichter passen nicht auf die Folie");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: FORMATE.feed.breite, height: FORMATE.feed.hoehe } });
for (const a of auswahl) {
  const titel = titelDe[a.id] ?? a.titel;
  const ordner = `out/${a.id}`;
  await mkdir(pfad(ordner), { recursive: true });
  const folien = { "1-uebersicht": uebersichtHtml(a, { titel, assets, css }) };
  abgeordneteFolien(a, { titel, personen, assets, css }).forEach((html, i) => { folien[`${i + 2}-abgeordnete`] = html; });
  for (const [name, html] of Object.entries(folien)) {
    const datei = pfad(`${ordner}/${name}.html`);
    await writeFile(datei, html);
    await page.goto(pathToFileURL(datei).href);
    await page.evaluate(() => document.fonts.ready);
    await gesichterEinpassen(page);
    await page.screenshot({ path: pfad(`${ordner}/${name}.png`) });
    console.log(`${ordner}/${name}.png`);
  }
}
await browser.close();
