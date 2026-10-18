// Erklärpost „Was ist Piraten-Check EU?“ – als Karussell (4:5) und als Video (9:16, MP4) nach erklaer/.
// Beide entstehen aus denselben Szenen; das Video wird Bild für Bild aus der CSS-Animation gerendert.
// Aufruf: node scripts/erklaer.mjs   (braucht ffmpeg mit libx264 für das Video)
import { writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { badge, ABSENDER } from "../lib/grafik.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const datei = (p) => pathToFileURL(pfad(p)).href;
await mkdir(pfad("erklaer"), { recursive: true });
await mkdir(pfad("out/erklaer"), { recursive: true });

const fonts = ["oswald/500", "oswald/600", "oswald/700", "inter/400", "inter/600", "inter/700"]
  .map((f) => `@import url("${datei(`node_modules/@fontsource/${f}.css`)}");`).join("\n");
const signet = datei("assets/logos/piraten-signet.png");
const FARBE = { FOR: "#3fae49", AGAINST: "#b3122e", ABSTENTION: "#8f8a85", DID_NOT_VOTE: "#d6d2cd" };

// Element, das nach `d` Sekunden (ab Szenenbeginn) hereingleitet.
const r = (d, html, klasse = "") => `<div class="r ${klasse}" style="--d:${d}">${html}</div>`;
const balken = (teile) => `<div class="balken">${teile.map(([w, s]) => `<i style="flex:${w};background:${FARBE[s]}"></i>`).join("")}</div>`;

const SZENEN = [
  {
    dauer: 4.5,
    html: `
      ${r(0.2, `<div class="dach">EU-Parlament</div>`)}
      ${r(0.5, `<h1>Seit 2024 sitzen die <b>PIRATEN</b> nicht mehr im EU-Parlament.</h1>`)}
      ${r(1.9, `<h1 class="orange">Wie hätten sie abgestimmt?</h1>`)}`,
  },
  {
    dauer: 6,
    html: `
      ${r(0.2, `<div class="person"><img src="${signet}"><div><div class="name">Markéta Gregorová</div><div class="rolle">Piratin aus Tschechien (Piráti),<br>Abgeordnete im EU-Parlament</div></div></div>`)}
      ${r(1.3, `<p class="gross">Die Piratenparteien Europas teilen ihre Grundwerte: Freiheit, Transparenz, Bürgerrechte, Digitales.</p>`)}
      ${r(2.8, `<p class="gross">Deshalb zeigen wir ihr Votum als <b>„So hätten die PIRATEN gestimmt“</b>.</p>`)}`,
  },
  {
    dauer: 6,
    html: `
      ${r(0.2, `<h2>Wo es Unterschiede gibt</h2>`)}
      ${r(0.7, `<p class="gross">Wo die deutschen PIRATEN anders stehen – zum Beispiel bei <b>Atomkraft</b> –, zeigen wir ihre Position und sagen es dazu.</p>`)}
      ${r(2.4, `<div class="kasten">${badge("FOR", 64)}<span>Jeder Post wird vorher von Menschen geprüft und freigegeben.</span></div>`)}`,
  },
  {
    dauer: 6.5,
    html: `
      ${r(0.2, `<h2>So liest du die Grafiken</h2>`)}
      <div class="legende">
        ${r(0.7, `${badge("FOR", 72)}<span>Dafür</span>`, "zeile")}
        ${r(1.2, `${badge("AGAINST", 72)}<span>Dagegen</span>`, "zeile")}
        ${r(1.7, `${badge("ABSTENTION", 72)}<span>Enthaltung</span>`, "zeile")}
        ${r(2.2, `${badge("GESPALTEN", 72)}<span>Partei gespalten</span>`, "zeile")}
        ${r(2.7, `${badge("DID_NOT_VOTE", 72)}<span>Nicht abgestimmt</span>`, "zeile")}
      </div>`,
  },
  {
    dauer: 6,
    html: `
      ${r(0.2, `<h2>Alle deutschen Parteien im Vergleich</h2>`)}
      ${r(0.7, `<div class="karte">
        <div class="kopf"><img src="${signet}">So hätten die PIRATEN gestimmt ${badge("FOR", 44)}</div>
        ${[["FOR", [[80, "FOR"], [20, "DID_NOT_VOTE"]]], ["AGAINST", [[12, "FOR"], [80, "AGAINST"], [8, "DID_NOT_VOTE"]]], ["ABSTENTION", [[100, "ABSTENTION"]]], ["FOR", [[64, "FOR"], [10, "AGAINST"], [26, "DID_NOT_VOTE"]]]]
          .map(([e, t]) => `<div class="reihe"><div class="platz"></div>${balken(t)}${badge(e, 48)}</div>`).join("")}
      </div>`)}
      ${r(2.2, `<p class="mittel">Plus die Gesichter aller deutschen Abgeordneten – wer hat wie gestimmt?</p>`)}`,
  },
  {
    dauer: 6,
    letzte: true,
    html: `
      ${r(0.2, `<div class="absender-gross"><img src="${signet}"><span>${ABSENDER}</span></div>`)}
      ${r(1.0, `<p class="gross">Mehrmals pro Woche: die wichtigsten Abstimmungen im EU-Parlament.</p>`)}
      ${r(2.0, `<ul class="fakten"><li>Daten: HowTheyVote.eu</li><li>Code offen auf GitHub</li><li>Kein offizieller Kanal der Piratenpartei</li></ul>`)}
      ${r(3.0, `<div class="folgen">Folgen nicht vergessen!</div>`)}`,
  },
];

const CSS = `${fonts}
:root { --blau: #24408e; --orange: #ff8800; }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; }
body { font-family: "Inter", sans-serif; color: #fff;
  background:
    radial-gradient(ellipse 120% 70% at 80% 115%, transparent 40%, rgba(255,255,255,.06) 40.5%, transparent 43%),
    radial-gradient(ellipse 120% 70% at 80% 115%, transparent 52%, rgba(255,255,255,.06) 52.5%, transparent 55%),
    radial-gradient(ellipse 120% 70% at 80% 115%, transparent 64%, rgba(255,255,255,.06) 64.5%, transparent 67%),
    linear-gradient(160deg, #2a4ba3 0%, #24408e 55%, #1c3372 100%); }
.szene { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 36px; padding: var(--rand); }
b { color: var(--orange); font-weight: inherit; }
.dach { font-family: "Oswald"; font-weight: 500; font-size: 40px; letter-spacing: .08em; text-transform: uppercase; color: #c3cdea; }
h1 { margin: 0; font-family: "Oswald"; font-weight: 700; font-size: var(--h1); line-height: 1.05; text-transform: uppercase; }
h1.orange { color: var(--orange); }
h2 { margin: 0; font-family: "Oswald"; font-weight: 700; font-size: var(--h2); line-height: 1.05; text-transform: uppercase; }
p { margin: 0; }
.gross { font-size: var(--text); font-weight: 600; line-height: 1.3; }
.mittel { font-size: calc(var(--text) * .85); font-weight: 600; line-height: 1.3; color: #e4e9f6; }
.person { display: flex; align-items: center; gap: 32px; }
.person img { width: 150px; height: 150px; flex: none; }
.person .name { font-family: "Oswald"; font-weight: 700; font-size: 64px; line-height: 1.05; }
.person .rolle { font-size: 32px; color: #c3cdea; margin-top: 8px; line-height: 1.3; }
.kasten { display: flex; align-items: center; gap: 24px; background: #fff; color: var(--blau); border-radius: 18px; padding: 28px 32px; font-size: 36px; font-weight: 700; line-height: 1.25; box-shadow: 0 14px 40px rgba(0,0,0,.25); }
.kasten .badge { flex: none; }
.legende { display: flex; flex-direction: column; gap: 22px; }
.zeile { display: flex; align-items: center; gap: 28px; font-family: "Oswald"; font-weight: 600; font-size: 54px; }
.zeile .badge { flex: none; }
.karte { background: #fff; color: var(--blau); border-radius: 20px; padding: 28px 28px 14px; box-shadow: 0 14px 40px rgba(0,0,0,.28); }
.karte .kopf { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 4px solid var(--orange); margin-bottom: 20px; font-family: "Oswald"; font-weight: 600; font-size: 34px; text-transform: uppercase; }
.karte .kopf img { width: 52px; height: 52px; }
.karte .kopf .badge { margin-left: auto; }
.reihe { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
.platz { width: 110px; height: 30px; border-radius: 6px; background: #e5e9f2; flex: none; }
.balken { flex: 1; display: flex; gap: 3px; height: 18px; }
.balken i { border-radius: 4px; }
.reihe .badge { flex: none; }
.absender-gross { display: flex; align-items: center; gap: 28px; font-family: "Oswald"; font-weight: 700; font-size: 84px; text-transform: uppercase; line-height: 1; }
.absender-gross img { width: 130px; height: 130px; }
.fakten { margin: 0; padding-left: 36px; font-size: 34px; line-height: 1.55; color: #e4e9f6; }
.folgen { display: inline-block; background: var(--orange); color: #fff; font-family: "Oswald"; font-weight: 700; font-size: 48px; text-transform: uppercase; padding: 14px 30px; border-radius: 14px; }

/* Video: Szenen nacheinander, Elemente gleiten herein */
.video .szene { animation: szene calc(var(--dauer) * 1s) linear both; animation-delay: calc(var(--start) * 1s); }
.video .szene.letzte { animation-name: letzte; }
.video .r { animation: rein .7s cubic-bezier(.2,.8,.2,1) both; animation-delay: calc((var(--start) + var(--d)) * 1s); }
@keyframes szene { 0% { opacity: 0 } 6% { opacity: 1 } 93% { opacity: 1 } 100% { opacity: 0 } }
@keyframes letzte { 0% { opacity: 0 } 6% { opacity: 1 } 100% { opacity: 1 } }
@keyframes rein { from { opacity: 0; transform: translateY(40px) } to { opacity: 1; transform: none } }

/* Karussell: eine Szene je Bild, Fußzeile mit Absender und Seitenzahl */
.fuss { position: absolute; left: var(--rand-x); right: var(--rand-x); bottom: 44px; display: flex; align-items: center; gap: 12px; font-family: "Oswald"; font-weight: 600; font-size: 26px; text-transform: uppercase; color: #c3cdea; }
.fuss img { width: 34px; height: 34px; }
.fuss .seite { margin-left: auto; }
.weiter { position: absolute; right: var(--rand-x); bottom: 110px; font-family: "Oswald"; font-weight: 600; font-size: 34px; color: var(--orange); text-transform: uppercase; }
`;

// Video 1080×1920: oben und unten blenden TikTok & Co. Bedienelemente ein, rechts die Buttons.
const VIDEO = { breite: 1080, hoehe: 1920, vars: "--rand: 260px 170px 420px 80px; --h1: 104px; --h2: 76px; --text: 46px;" };
// Karussell 1080×1350 (4:5).
const KARUSSELL = { breite: 1080, hoehe: 1350, vars: "--rand: 90px 80px 150px; --rand-x: 80px; --h1: 92px; --h2: 68px; --text: 42px;" };

function videoHtml() {
  let start = 0;
  const szenen = SZENEN.map((s) => {
    const html = `<section class="szene${s.letzte ? " letzte" : ""}" style="--start:${start};--dauer:${s.dauer}">${s.html}</section>`;
    start += s.dauer;
    return html;
  });
  return { html: seite(VIDEO, "video", szenen.join("")), dauer: start };
}

function karussellHtml(i) {
  const s = SZENEN[i];
  const fuss = `<div class="fuss"><img src="${signet}">${ABSENDER}<span class="seite">${i + 1}/${SZENEN.length}</span></div>`;
  const weiter = i === 0 ? `<div class="weiter">Wischen →</div>` : "";
  return seite(KARUSSELL, "karussell", `<section class="szene">${s.html}</section>${weiter}${fuss}`);
}

function seite(format, klasse, inhalt) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${CSS}
:root { ${format.vars} }
html, body { width: ${format.breite}px; height: ${format.hoehe}px; }
</style></head><body class="${klasse}">${inhalt}</body></html>`;
}

async function laden(page, name, html) {
  // Über eine Datei laden – von about:blank aus dürfen keine lokalen Schriften und Bilder geladen werden.
  const datei = pfad(`out/erklaer/${name}.html`);
  await writeFile(datei, html);
  await page.goto(pathToFileURL(datei).href);
  await page.evaluate(() => document.fonts.ready);
}

const FPS = 30;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();

  await page.setViewportSize({ width: KARUSSELL.breite, height: KARUSSELL.hoehe });
  for (const i of SZENEN.keys()) {
    await laden(page, `karussell-${i + 1}`, karussellHtml(i));
    await page.screenshot({ path: pfad(`erklaer/karussell-${i + 1}.png`) });
    console.log(`erklaer/karussell-${i + 1}.png`);
  }

  // Video: Animationen anhalten und für jedes Bild auf den Zeitpunkt setzen – so ist jedes Bild exakt.
  await page.setViewportSize({ width: VIDEO.breite, height: VIDEO.hoehe });
  const { html, dauer } = videoHtml();
  await laden(page, "video", html);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  const bilder = Math.round(dauer * FPS);
  const ffmpeg = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    // Stumme Tonspur: manche Plattformen (Instagram) mögen Videos ohne Ton nicht.
    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-shortest",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", "-movflags", "+faststart",
    "-c:a", "aac", pfad("erklaer/video.mp4"),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const fertig = new Promise((ok, fehler) => ffmpeg.on("close", (code) => (code === 0 ? ok() : fehler(new Error(`ffmpeg: Exit ${code}`)))));
  for (let n = 0; n < bilder; n++) {
    await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.currentTime = ms; }), (n / FPS) * 1000);
    const bild = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ffmpeg.stdin.write(bild)) await new Promise((ok) => ffmpeg.stdin.once("drain", ok));
  }
  ffmpeg.stdin.end();
  await fertig;
  console.log(`erklaer/video.mp4 (${dauer} s)`);
} finally {
  await browser.close();
}
