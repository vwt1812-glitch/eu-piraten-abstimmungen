import { test } from "node:test";
import assert from "node:assert/strict";
import { bildformat, keinBild } from "../lib/bilder.mjs";

test("Bilder an den ersten Bytes erkennen, Fehlerseiten nicht", () => {
  assert.equal(bildformat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpeg");
  assert.equal(bildformat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(bildformat(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "latin1")), "webp");
  assert.equal(bildformat(Buffer.from("<!DOCTYPE html><html>Access denied</html>")), null);
  assert.equal(bildformat(Buffer.alloc(0)), null);
  assert.match(keinBild(Buffer.from("<html>\n  Access denied</html>"), "text/html"), /^text\/html, \d+ Bytes, beginnt mit „<html> Access denied/);
});

test("Gesicht: Initialen liegen unter dem Foto, ein kaputtes Foto entfernt sich", async () => {
  const { abgeordneteFolien } = await import("../lib/grafik.mjs");
  const a = {
    id: 1, zeitpunkt: "2026-10-08 12:00:00", titel: "T", ergebnis: "ADOPTED",
    stimmen: { FOR: 1, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0 },
    deutschland: [{ partei: "CDU", FOR: 1, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0, mehrheit: "FOR" }],
    abgeordnete: [[7, "CDU", "FOR"]],
    piraten: { position: "FOR", quelle: "referenz" },
  };
  const [html] = abgeordneteFolien(a, { titel: "T", personen: { 7: { vorname: "Erika", nachname: "MUSTER" } }, assets: { portraets: { 7: "file:///x/7.jpg" } }, css: "" });
  assert.match(html, /<span class="foto foto-leer">EM<\/span><img class="foto foto-bild" src="file:\/\/\/x\/7\.jpg" alt="" onerror="this\.remove\(\)">/);
});

test("Browser besteht eine Bot-Abwehr (202 + JavaScript-Cookie) und lädt das Bild", async (t) => {
  const { chromium } = await import("playwright");
  let browser;
  try {
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  } catch {
    return t.skip("kein Chromium installiert");
  }
  const { createServer } = await import("node:http");
  const { imBrowserLaden, browserKennung } = await import("../lib/bilder.mjs");
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  const server = createServer((req, res) => {
    if (/HeadlessChrome/.test(req.headers["user-agent"])) return res.writeHead(403).end("bot");
    if (!/geprueft=1/.test(req.headers.cookie ?? "")) {
      res.writeHead(202, { "content-type": "text/html" });
      return res.end(`<script>document.cookie="geprueft=1; path=/"; location.reload();</script>`);
    }
    if (req.url === "/fehlt.jpg") return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "image/jpeg" }).end(jpeg);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = `http://127.0.0.1:${server.address().port}`;
  try {
    const kontext = await browser.newContext({ userAgent: browserKennung(browser.version()) });
    assert.deepEqual(await imBrowserLaden(kontext, `${basis}/123.jpg`, { timeout: 10000 }), jpeg);
    assert.equal(await imBrowserLaden(kontext, `${basis}/fehlt.jpg`, { timeout: 3000 }), null);
  } finally {
    await browser.close();
    server.close();
  }
});
