// Rendert Profilbild und Banner für die Social-Media-Accounts nach profil/ – im Stil der Grafiken.
// Aufruf: node scripts/profil.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { badge, ABSENDER } from "../lib/grafik.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const datei = (p) => pathToFileURL(pfad(p)).href;
await mkdir(pfad("profil"), { recursive: true });
await mkdir(pfad("out/profil"), { recursive: true });

const fonts = ["oswald/500", "oswald/600", "oswald/700", "inter/400", "inter/600"]
  .map((f) => `@import url("${datei(`node_modules/@fontsource/${f}.css`)}");`).join("\n");
const signet = datei("assets/logos/piraten-signet.png");

const BASIS = `${fonts}
:root { --dunkel: #1d1d1b; --orange: #ff8800; --hell: #faf8f5; }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; }
body { font-family: "Inter", sans-serif; }
/* Wie Kopf und Fuß der Grafiken: Anthrazit mit orangem Streifen */
.dunkel { background: var(--dunkel); }`;

// Profilbild (500 px – das Signet liegt nur in 240 px vor, größer wird es unscharf): Signet auf Anthrazit,
// unten rechts der grüne Haken der Grafiken. Alles liegt im Kreis (Plattformen schneiden rund).
const profilbild = (groesse) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASIS}
body { width: ${groesse}px; height: ${groesse}px; }
.flaeche { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }
.signet { width: 68%; height: 68%; border-radius: 50%; }
.signet img { width: 100%; height: 100%; display: block; }
.haken { position: absolute; left: 64%; top: 64%; }
.haken .badge { width: ${groesse * 0.2}px; height: ${groesse * 0.2}px; }
</style></head><body><div class="flaeche dunkel">
  <div class="signet"><img src="${signet}"></div>
  <div class="haken">${badge("FOR", 100)}</div>
</div></body></html>`;

// Banner: Aussage links (frei vom Profilbild, das bei X unten links überlappt), rechts eine Miniatur der Übersicht.
const ZEILEN = [
  ["FOR", [[78, "FOR"], [22, "DID_NOT_VOTE"]]],
  ["AGAINST", [[12, "FOR"], [80, "AGAINST"], [8, "DID_NOT_VOTE"]]],
  ["ABSTENTION", [[100, "ABSTENTION"]]],
];
const FARBE = { FOR: "#3fae49", AGAINST: "#b3122e", ABSTENTION: "#8f8a85", DID_NOT_VOTE: "#d6d2cd" };
const banner = ({ breite, hoehe, links, rechts = 90, karte = 430, titel = 76, unter = 24 }) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASIS}
body { width: ${breite}px; height: ${hoehe}px; }
.flaeche { width: 100%; height: 100%; position: relative; display: flex; align-items: center; padding: 0 ${rechts}px 0 ${links}px; gap: 64px; border-bottom: 10px solid var(--orange); }
.text { flex: 1; min-width: 0; color: #fff; }
.zeile1 { white-space: nowrap; font-family: "Oswald"; font-weight: 500; font-size: 30px; letter-spacing: .06em; text-transform: uppercase; color: var(--orange); }
h1 { margin: 6px 0 14px; font-family: "Oswald"; font-weight: 700; font-size: ${titel}px; line-height: 1.02; text-transform: uppercase; }
h1 b { color: var(--orange); }
.unter { white-space: nowrap; font-size: ${unter}px; font-weight: 600; color: #cfc8c0; }
.karte { width: ${karte}px; flex: none; background: var(--hell); border-radius: 18px; padding: 18px 20px 8px; box-shadow: 0 14px 40px rgba(0,0,0,.4); transform: rotate(-2deg); }
.band { display: flex; align-items: center; gap: 12px; background: #fff3e4; border: 3px solid var(--orange); border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; font-family: "Oswald"; font-weight: 500; font-size: 26px; white-space: nowrap; color: var(--dunkel); }
.band img { width: 38px; height: 38px; }
.band b { color: var(--orange); font-weight: 700; }
.band .badge { width: 36px; height: 36px; margin-left: auto; }
.reihe { display: flex; align-items: center; gap: 14px; padding: 10px 2px; border-bottom: 1px solid #e4ded7; }
.reihe:last-child { border-bottom: 0; }
.platz { width: 70px; height: 22px; border-radius: 5px; background: #e4ded7; flex: none; }
.balken { flex: 1; display: flex; gap: 3px; height: 13px; }
.balken i { border-radius: 3px; }
.reihe .badge { width: 36px; height: 36px; flex: none; }
</style></head><body><div class="flaeche dunkel">
  <div class="text">
    <div class="zeile1">${ABSENDER} · EU-Parlament</div>
    <h1>So hätten die <b>PIRATEN</b> gestimmt</h1>
    <div class="unter">Jede Abstimmung · alle deutschen Parteien im Vergleich</div>
  </div>
  <div class="karte">
    <div class="band"><img src="${signet}"><span>PIRATEN: <b>DAFÜR</b></span>${badge("FOR", 36)}</div>
    ${ZEILEN.map(([ergebnis, teile]) => `<div class="reihe"><div class="platz"></div><div class="balken">${teile.map(([w, s]) => `<i style="flex:${w};background:${FARBE[s]}"></i>`).join("")}</div>${badge(ergebnis, 36)}</div>`).join("")}
  </div>
</div></body></html>`;

const AUSGABEN = [
  { name: "profilbild.png", html: profilbild(500), breite: 500, hoehe: 500 },
  // X, Mastodon und Bluesky (3:1). X legt das Profilbild unten links darüber → Text weiter rechts.
  { name: "banner-3x1.png", html: banner({ breite: 1500, hoehe: 500, links: 300, rechts: 80, karte: 400, titel: 70, unter: 21 }), breite: 1500, hoehe: 500, skala: 2 },
  // Facebook-Titelbild; mobil werden die Seiten beschnitten → Inhalt mittiger.
  { name: "banner-facebook.png", html: banner({ breite: 1640, hoehe: 624, links: 170, rechts: 170 }), breite: 1640, hoehe: 624 },
];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  for (const a of AUSGABEN) {
    const page = await browser.newPage({ viewport: { width: a.breite, height: a.hoehe }, deviceScaleFactor: a.skala ?? 1 });
    // Über eine Datei laden – von about:blank aus dürfen keine lokalen Schriften und Bilder geladen werden.
    const html = pfad(`out/profil/${a.name.replace(/\.png$/, ".html")}`);
    await writeFile(html, a.html);
    await page.goto(pathToFileURL(html).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: pfad(`profil/${a.name}`) });
    await page.close();
    console.log(`profil/${a.name}`);
  }
} finally {
  await browser.close();
}
