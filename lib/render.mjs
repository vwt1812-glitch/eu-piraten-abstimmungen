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
    const m = datei.match(/^(\d+)\.(jpg|png|webp)$/);
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

// Passt den Inhalt in die Folie ein:
// - Gesichter (--gesicht) in 2-px-Schritten verkleinern,
// - Parteizeilen (--zeile) verkleinern; reicht das nicht, Stichpunkte der Erklärung weglassen (zuletzt die
//   ganze Erklärung samt KI-Hinweis) – die Ergebnisse der Parteien haben Vorrang.
async function einpassen(page) {
  const fehler = await page.evaluate(() => {
    const ueberlauf = (el) => el.scrollHeight > el.clientHeight;
    const verkleinern = (el, variable, minimum) => {
      let px = parseInt(el.style.getPropertyValue(variable), 10);
      while (px > minimum && ueberlauf(el)) {
        px -= 2;
        el.style.setProperty(variable, `${px}px`);
      }
    };
    const fehler = [];

    // Lange Namen unter den Gesichtern: erst kleinere Schrift, dann zwei Zeilen statt „…“.
    // scrollWidth ist gerundet und übersieht knappe Fälle („Herham…“) – daher die echte Textbreite messen.
    const textMass = (fc) => {
      const r = document.createRange();
      r.selectNodeContents(fc);
      return r.getBoundingClientRect();
    };
    const zuBreit = (fc) => textMass(fc).width > fc.getBoundingClientRect().width + 0.01;
    const zuHoch = (fc) => textMass(fc).height > 2.2 * parseFloat(getComputedStyle(fc).fontSize) * 1.05 + 0.5;
    const namenEinpassen = () => {
      for (const fc of document.querySelectorAll(".abgeordnete figcaption")) {
        fc.classList.remove("zweizeilig");
        fc.style.fontSize = "";
        let px = parseFloat(getComputedStyle(fc).fontSize);
        while (px > 10 && zuBreit(fc)) fc.style.fontSize = `${--px}px`;
        if (!zuBreit(fc)) continue;
        fc.classList.add("zweizeilig");
        px = 13;
        fc.style.fontSize = `${px}px`;
        while (px > 9 && (zuBreit(fc) || zuHoch(fc))) fc.style.fontSize = `${--px}px`;
      }
    };

    const gesichter = document.querySelector(".abgeordnete");
    if (gesichter) {
      let px = parseInt(gesichter.style.getPropertyValue("--gesicht"), 10);
      namenEinpassen();
      while (px > 40 && ueberlauf(gesichter)) {
        px -= 2;
        gesichter.style.setProperty("--gesicht", `${px}px`);
        namenEinpassen();
      }
      if (ueberlauf(gesichter)) fehler.push(".abgeordnete");
    }

    const parteien = document.querySelector(".parteien");
    if (parteien) {
      const start = parteien.style.getPropertyValue("--zeile");
      for (;;) {
        parteien.style.setProperty("--zeile", start);
        verkleinern(parteien, "--zeile", 48);
        if (!ueberlauf(parteien)) break;
        const erklaerung = document.querySelector(".erklaerung");
        if (!erklaerung) break;
        const punkte = erklaerung.querySelectorAll("li");
        if (punkte.length > 1) punkte[punkte.length - 1].remove();
        else {
          erklaerung.remove();
          document.querySelector(".ki-quelle")?.remove();
        }
      }
      verkleinern(parteien, "--zeile", 44);
      if (ueberlauf(parteien)) fehler.push(".parteien");
    }
    return fehler;
  });
  for (const f of fehler) console.warn(`Warnung: ${f} passt nicht auf die Folie`);
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

// Ersetzt den englischen Titel von HowTheyVote durch den deutschen, falls vorhanden,
// und hängt die deutsche Zusammenfassung von check-some-votes an (zusammenfassung: [Stichpunkte] oder null).
export async function mitDeutschemTitel(abstimmungen) {
  const titel = await deutscheTitel();
  const zusammenfassungen = JSON.parse(await readFile(pfad("daten/zusammenfassungen.json"), "utf8").catch(() => "{}"));
  return abstimmungen.map((a) => ({ ...a, titel: titel[a.id] || a.titel, zusammenfassung: zusammenfassungen[a.id]?.punkte ?? null }));
}
