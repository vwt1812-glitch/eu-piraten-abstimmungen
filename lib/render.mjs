// Rendert die Sharepics einer Abstimmung mit Chromium als PNG nach out/<id>/.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { uebersichtHtml, abgeordneteFolien, FORMATE } from "./grafik.mjs";

const wurzel = new URL("../", import.meta.url);
const pfad = (p) => fileURLToPath(new URL(p, wurzel));

async function assetsLaden() {
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
  return { logos, portraets };
}

async function cssLaden() {
  // Schriften aus @fontsource
  const fonts = ["oswald/500", "oswald/600", "oswald/700", "inter/400", "inter/600", "inter/700"]
    .map((f) => `@import url("${pathToFileURL(pfad(`node_modules/@fontsource/${f}.css`))}");`).join("\n");
  return fonts + "\n" + (await readFile(pfad("assets/grafik.css"), "utf8"));
}

// Verkleinert Gesichter (--gesicht) bzw. Parteizeilen (--zeile) in 2-px-Schritten, bis nichts mehr überläuft.
async function einpassen(page) {
  const ergebnis = await page.evaluate(() => {
    const fehler = [];
    for (const [auswahl, variable, minimum] of [[".abgeordnete", "--gesicht", 40], [".parteien", "--zeile", 44]]) {
      const bereich = document.querySelector(auswahl);
      if (!bereich) continue;
      let px = parseInt(bereich.style.getPropertyValue(variable), 10);
      while (px > minimum && bereich.scrollHeight > bereich.clientHeight) {
        px -= 2;
        bereich.style.setProperty(variable, `${px}px`);
      }
      if (bereich.scrollHeight > bereich.clientHeight) fehler.push(auswahl);
    }
    return fehler;
  });
  for (const f of ergebnis) console.warn(`Warnung: ${f} passt nicht auf die Folie`);
}

// abstimmungen: mit deutschem Titel in .titel.
// Gibt { [id]: { feed: [png …], hoch: [png …] } } zurück, jeweils in Karussell-Reihenfolge.
export async function grafikenRendern(abstimmungen, personen, formate = Object.values(FORMATE)) {
  const css = await cssLaden();
  const assets = await assetsLaden();
  const ergebnis = {};

  // Auf dem Raspberry Pi das Chromium aus apt (CHROMIUM_PATH), sonst das von Playwright.
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage();
    for (const a of abstimmungen) {
      ergebnis[a.id] = {};
      for (const format of formate) {
        await page.setViewportSize({ width: format.breite, height: format.hoehe });
        const ordner = `out/${a.id}/${format.name}`;
        await mkdir(pfad(ordner), { recursive: true });
        const optionen = { titel: a.titel, personen, assets, css, format };
        const folien = { "1-uebersicht": uebersichtHtml(a, optionen) };
        abgeordneteFolien(a, optionen).forEach((html, i) => { folien[`${i + 2}-abgeordnete`] = html; });

        ergebnis[a.id][format.name] = [];
        for (const [name, html] of Object.entries(folien)) {
          const datei = pfad(`${ordner}/${name}.html`);
          await writeFile(datei, html);
          await page.goto(pathToFileURL(datei).href);
          await page.evaluate(() => document.fonts.ready);
          await einpassen(page);
          const png = pfad(`${ordner}/${name}.png`);
          await page.screenshot({ path: png });
          ergebnis[a.id][format.name].push(png);
        }
      }
    }
  } finally {
    await browser.close();
  }
  return ergebnis;
}

// Deutsche Titel: von Hand (titel.json) vor automatisch (daten/titel_auto.json, check-some-votes.eu).
export async function deutscheTitel() {
  const lesen = async (p) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => "{}"));
  const hand = Object.fromEntries(Object.entries(await lesen("titel.json")).filter(([, t]) => t));
  return { ...(await lesen("daten/titel_auto.json")), ...hand };
}

// Ersetzt den englischen Titel von HowTheyVote durch den deutschen, falls vorhanden.
export async function mitDeutschemTitel(abstimmungen) {
  const titel = await deutscheTitel();
  return abstimmungen.map((a) => ({ ...a, titel: titel[a.id] || a.titel }));
}
