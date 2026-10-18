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

// abstimmungen: mit deutschem Titel in .titel. Gibt { [id]: [png-Pfade in Karussell-Reihenfolge] } zurück.
export async function grafikenRendern(abstimmungen, personen) {
  const css = await cssLaden();
  const assets = await assetsLaden();
  const ergebnis = {};

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: FORMATE.feed.breite, height: FORMATE.feed.hoehe } });
    for (const a of abstimmungen) {
      const ordner = `out/${a.id}`;
      await mkdir(pfad(ordner), { recursive: true });
      const folien = { "1-uebersicht": uebersichtHtml(a, { titel: a.titel, assets, css }) };
      abgeordneteFolien(a, { titel: a.titel, personen, assets, css }).forEach((html, i) => { folien[`${i + 2}-abgeordnete`] = html; });

      ergebnis[a.id] = [];
      for (const [name, html] of Object.entries(folien)) {
        const datei = pfad(`${ordner}/${name}.html`);
        await writeFile(datei, html);
        await page.goto(pathToFileURL(datei).href);
        await page.evaluate(() => document.fonts.ready);
        await gesichterEinpassen(page);
        const png = pfad(`${ordner}/${name}.png`);
        await page.screenshot({ path: png });
        ergebnis[a.id].push(png);
      }
    }
  } finally {
    await browser.close();
  }
  return ergebnis;
}

// Deutscher Titel aus data/titel.json, sonst der englische von HowTheyVote.
export async function mitDeutschemTitel(abstimmungen) {
  const titel = JSON.parse(await readFile(pfad("data/titel.json"), "utf8").catch(() => "{}"));
  return abstimmungen.map((a) => ({ ...a, titel: titel[a.id] ?? a.titel }));
}
