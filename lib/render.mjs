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

    // Eng zugeschnittene, fast quadratische Fotos (Ersatz von check-some-votes) im 4:5-Feld nicht noch weiter
    // beschneiden: ganz zeigen, unten ausrichten – oben bleibt heller Hintergrund wie Luft über dem Kopf.
    for (const img of document.querySelectorAll(".kopf img.foto-bild")) {
      if (img.naturalWidth && img.naturalWidth / img.naturalHeight > 0.9) img.classList.add("eng");
    }

    // Lange Namen unter den Gesichtern: erst kleinere Schrift, dann zwei Zeilen statt „…“.
    // scrollWidth ist gerundet und übersieht knappe Fälle („Herham…“) – daher die echte Textbreite messen.
    const textMass = (fc) => {
      const r = document.createRange();
      r.selectNodeContents(fc);
      return r.getBoundingClientRect();
    };
    const zuBreit = (fc) => textMass(fc).width > fc.getBoundingClientRect().width + 0.01;
    // Zweizeilig: Wort für Wort messen (die Texthöhe taugt nicht – line-clamp kürzt still mit „…“).
    // Passt, wenn jedes Wort in die Breite passt und der Name höchstens zwei Zeilen braucht.
    const messung = document.createElement("canvas").getContext("2d");
    const passtZweizeilig = (fc) => {
      const stil = getComputedStyle(fc);
      messung.font = `${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
      const breite = fc.getBoundingClientRect().width;
      const woerter = fc.textContent.trim().split(/\s+|(?<=-)/);
      let zeilen = 1, zeile = "";
      for (const wort of woerter) {
        if (messung.measureText(wort).width > breite) return false;
        const versuch = zeile ? (zeile.endsWith("-") ? zeile + wort : `${zeile} ${wort}`) : wort;
        if (messung.measureText(versuch).width <= breite) zeile = versuch;
        else { zeilen++; zeile = wort; }
      }
      return zeilen <= 2;
    };
    const namenEinpassen = () => {
      for (const fc of document.querySelectorAll(".abgeordnete figcaption")) {
        fc.classList.remove("zweizeilig");
        fc.style.fontSize = "";
        let px = parseFloat(getComputedStyle(fc).fontSize);
        // Ein einzelnes Wort (z. B. „Schnurrbusch“) lieber kleiner als mitten im Wort umbrechen.
        const minimum = /[\s-]/.test(fc.textContent.trim()) ? 10 : 8;
        while (px > minimum && zuBreit(fc)) fc.style.fontSize = `${--px}px`;
        if (!zuBreit(fc)) continue;
        fc.classList.add("zweizeilig");
        px = 13;
        fc.style.fontSize = `${px}px`;
        while (px > 8 && !passtZweizeilig(fc)) fc.style.fontSize = `${--px}px`;
      }
    };

    // Passt eine Partei nicht in eine halbe Spalte, bekommt sie die ganze Breite.
    const spaltenSetzen = () => {
      const raster = document.querySelector(".abgeordnete");
      const halb = (raster.clientWidth - parseFloat(getComputedStyle(raster).columnGap)) / 2;
      for (const g of document.querySelectorAll(".abgeordnete .gruppe")) {
        const gesichter = g.querySelector(".gesichter");
        const logo = g.querySelector(".gruppe-logo");
        const figuren = [...gesichter.children];
        const breite = figuren[0].getBoundingClientRect().width;
        const abstand = parseFloat(getComputedStyle(gesichter).columnGap) || 0;
        const noetig = logo.getBoundingClientRect().width + parseFloat(getComputedStyle(g).columnGap) + figuren.length * (breite + abstand) - abstand;
        g.classList.toggle("breit", noetig > halb);
      }
      // Bleibt eine halbe Partei allein in ihrer Zeile, bekommt sie die ganze Breite statt Leere daneben.
      const halbe = [...document.querySelectorAll(".abgeordnete .gruppe:not(.breit)")];
      if (halbe.length % 2) halbe.at(-1).classList.add("breit");
    };

    // Gesichter einer Partei gleichmäßig auf die Reihen verteilen (15 → 8 + 7 statt 14 + 1).
    const ausgleichen = () => {
      for (const g of document.querySelectorAll(".abgeordnete .gesichter")) {
        g.style.maxWidth = "";
        const figuren = [...g.children];
        const zeilen = new Set(figuren.map((f) => Math.round(f.offsetTop))).size;
        if (zeilen < 2) continue;
        const proZeile = Math.ceil(figuren.length / zeilen);
        const breite = figuren[0].getBoundingClientRect().width;
        const abstand = parseFloat(getComputedStyle(g).columnGap) || 0;
        g.style.maxWidth = `${proZeile * breite + (proZeile - 1) * abstand + 1}px`;
      }
    };

    const gesichter = document.querySelector(".abgeordnete");
    if (gesichter) {
      let px = parseInt(gesichter.style.getPropertyValue("--gesicht"), 10);
      spaltenSetzen();
      namenEinpassen();
      ausgleichen();
      while (px > 40 && ueberlauf(gesichter)) {
        px -= 1;
        gesichter.style.setProperty("--gesicht", `${px}px`);
        spaltenSetzen();
        namenEinpassen();
        ausgleichen();
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
