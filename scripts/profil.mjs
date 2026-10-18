// Rendert Profilbild und Banner für die Social-Media-Accounts nach profil/ – im Stil der Grafiken.
// Aufruf: node scripts/profil.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { badge } from "../lib/grafik.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const datei = (p) => pathToFileURL(pfad(p)).href;
await mkdir(pfad("profil"), { recursive: true });
await mkdir(pfad("out/profil"), { recursive: true });

const fonts = ["oswald/500", "oswald/600", "oswald/700", "inter/400", "inter/600"]
  .map((f) => `@import url("${datei(`node_modules/@fontsource/${f}.css`)}");`).join("\n");
const signet = datei("assets/logos/piraten-signet.png");

const BASIS = `${fonts}
:root { --blau: #24408e; --orange: #ff8800; }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; }
body { font-family: "Inter", sans-serif; }
.wellen {
  background:
    radial-gradient(ellipse 120% 90% at 85% 130%, transparent 40%, rgba(255,255,255,.06) 40.5%, transparent 43%),
    radial-gradient(ellipse 120% 90% at 85% 130%, transparent 52%, rgba(255,255,255,.06) 52.5%, transparent 55%),
    radial-gradient(ellipse 120% 90% at 85% 130%, transparent 64%, rgba(255,255,255,.06) 64.5%, transparent 67%),
    linear-gradient(160deg, #2a4ba3 0%, #24408e 55%, #1c3372 100%);
}`;

// Profilbild (500 px – das Signet liegt nur in 240 px vor, größer wird es unscharf): Signet auf Blau, unten rechts der grüne Haken der Grafiken. Alles liegt im Kreis (Plattformen schneiden rund).
const profilbild = (groesse) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASIS}
body { width: ${groesse}px; height: ${groesse}px; }
.flaeche { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: relative; }
.signet { width: 64%; height: 64%; border-radius: 50%; background: #fff; box-shadow: 0 ${groesse * 0.02}px ${groesse * 0.06}px rgba(0,0,0,.25); }
.signet img { width: 100%; height: 100%; display: block; }
.haken { position: absolute; left: 63%; top: 63%; }
.haken .badge { width: ${groesse * 0.2}px; height: ${groesse * 0.2}px; filter: drop-shadow(0 ${groesse * 0.01}px ${groesse * 0.02}px rgba(0,0,0,.3)); }
</style></head><body><div class="flaeche wellen">
  <div class="signet"><img src="${signet}"></div>
  <div class="haken">${badge("FOR", 100)}</div>
</div></body></html>`;

// Banner: Aussage links (frei vom Profilbild, das unten links überlappt), rechts angedeutete Abstimmungszeilen.
const ZEILEN = [
  ["FOR", [[78, "FOR"], [22, "DID_NOT_VOTE"]]],
  ["AGAINST", [[12, "FOR"], [80, "AGAINST"], [8, "DID_NOT_VOTE"]]],
  ["ABSTENTION", [[100, "ABSTENTION"]]],
  ["FOR", [[64, "FOR"], [10, "AGAINST"], [26, "DID_NOT_VOTE"]]],
];
const FARBE = { FOR: "#3fae49", AGAINST: "#b3122e", ABSTENTION: "#8f8a85", DID_NOT_VOTE: "#d6d2cd" };
const banner = ({ breite, hoehe, links, oben = 0 }) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASIS}
body { width: ${breite}px; height: ${hoehe}px; }
.flaeche { width: 100%; height: 100%; position: relative; display: flex; align-items: center; padding: ${oben}px 90px 0 ${links}px; gap: 70px; }
.text { flex: 1; min-width: 0; color: #fff; }
.zeile1 { white-space: nowrap; font-family: "Oswald"; font-weight: 500; font-size: 34px; letter-spacing: .06em; text-transform: uppercase; color: #c3cdea; }
h1 { margin: 4px 0 14px; font-family: "Oswald"; font-weight: 700; font-size: 78px; line-height: 1.02; text-transform: uppercase; }
h1 b { color: var(--orange); }
.unter { white-space: nowrap; font-size: 25px; font-weight: 600; color: #e4e9f6; }
.karte { width: 430px; flex: none; background: #fff; border-radius: 18px; padding: 22px 22px 14px; box-shadow: 0 14px 40px rgba(0,0,0,.28); transform: rotate(-2deg); }
.karte .kopf { display: flex; align-items: center; gap: 12px; padding: 0 4px 14px; border-bottom: 3px solid var(--orange); margin-bottom: 14px; font-family: "Oswald"; font-weight: 600; font-size: 24px; color: var(--blau); text-transform: uppercase; }
.karte .kopf img { width: 44px; height: 44px; }
.reihe { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
.platz { width: 70px; height: 22px; border-radius: 5px; background: #e5e9f2; flex: none; }
.balken { flex: 1; display: flex; gap: 3px; height: 14px; }
.balken i { border-radius: 3px; }
.reihe .badge { width: 40px; height: 40px; flex: none; }
</style></head><body><div class="flaeche wellen">
  <div class="text">
    <div class="zeile1">Abstimmungen im EU-Parlament</div>
    <h1>So hätten die <b>PIRATEN</b> gestimmt</h1>
    <div class="unter">Jede Abstimmung · alle deutschen Parteien im Vergleich</div>
  </div>
  <div class="karte">
    <div class="kopf"><img src="${signet}">Wer stimmt wie?</div>
    ${ZEILEN.map(([ergebnis, teile]) => `<div class="reihe"><div class="platz"></div><div class="balken">${teile.map(([w, s]) => `<i style="flex:${w};background:${FARBE[s]}"></i>`).join("")}</div>${badge(ergebnis, 40)}</div>`).join("")}
  </div>
</div></body></html>`;

const AUSGABEN = [
  { name: "profilbild.png", html: profilbild(500), breite: 500, hoehe: 500 },
  // X, Mastodon und Bluesky (3:1). X legt das Profilbild unten links darüber → Text weiter rechts.
  { name: "banner-3x1.png", html: banner({ breite: 1500, hoehe: 500, links: 300 }).replace("width: 430px", "width: 360px").replace("font-size: 25px", "font-size: 22px").replace("font-size: 78px", "font-size: 72px"), breite: 1500, hoehe: 500, skala: 2 },
  // Facebook-Titelbild; mobil werden die Seiten beschnitten → Inhalt mittiger.
  { name: "banner-facebook.png", html: banner({ breite: 1640, hoehe: 624, links: 170 }).replace("padding: 0px 90px", "padding: 0px 170px"), breite: 1640, hoehe: 624 },
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
