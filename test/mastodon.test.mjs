import { test } from "node:test";
import assert from "node:assert/strict";
import { mastodonLaenge, mastodonClient, mastodonStatus, mastodonPosten, inhaltswarnung, mastodonAusUmgebung, ohnePostizMastodon } from "../lib/mastodon.mjs";
import { kanalUebersicht } from "../lib/kanalauswahl.mjs";

const parteien = ["CDU", "SPD", "AfD", "Grüne", "CSU", "FDP", "BSW", "Freie Wähler", "Linke", "Volt", "Die PARTEI", "Parteilos", "Familie", "ÖDP", "PdF", "Tierschutz"];
const abstimmung = (titel = "Pilotprojekt zu europäischen Schulallianzen") => ({
  id: 198216, zeitpunkt: "2026-10-08 12:00:00", titel, ergebnis: "ADOPTED",
  deutschland: parteien.map((partei, i) => ({ partei, mehrheit: ["FOR", "AGAINST", "ABSTENTION", "GESPALTEN"][i % 4] })),
  piraten: { position: "FOR", quelle: "regel", hinweis: "Die deutschen PIRATEN lehnen Atomkraft ab – Überprüfung nötig." },
});

test("Mastodon: ungelistet, mit Inhaltswarnung, geplant – und Text samt Warnung unter 500 Zeichen", () => {
  const jetzt = Date.now();
  for (const titel of ["Kurz", "Überprüfung der Verordnung über Ökodesign-Anforderungen 🌍 ".repeat(8)]) {
    const datum = new Date(jetzt + 60 * 60 * 1000).toISOString();
    const body = mastodonStatus(abstimmung(titel), { mediaIds: ["1", "2"], datum, einstellungen: { sichtbarkeit: "unlisted", inhaltswarnung: "EU-Politik: {titel}" } });
    assert.equal(body.visibility, "unlisted");
    assert.equal(body.language, "de");
    assert.deepEqual(body.media_ids, ["1", "2"]);
    assert.equal(body.scheduled_at, datum);
    assert.match(body.spoiler_text, /^EU-Politik: /);
    assert.ok(mastodonLaenge(body.spoiler_text) <= 100);
    const laenge = mastodonLaenge(body.status) + mastodonLaenge(body.spoiler_text);
    assert.ok(laenge <= 500, `${laenge}`);
  }
});

test("Mastodon: Standard ist ungelistet; ohne Vorlage keine Warnung; zu knapper Termin → sofort", () => {
  const body = mastodonStatus(abstimmung(), { mediaIds: [], datum: new Date(Date.now() + 60 * 1000).toISOString(), einstellungen: { inhaltswarnung: "" } });
  assert.equal(body.visibility, "unlisted");
  assert.equal(body.spoiler_text, undefined);
  assert.equal(body.scheduled_at, undefined);
  assert.equal(inhaltswarnung(abstimmung("Sehr langer Titel ".repeat(20)), "EU-Politik: {titel}", 60).length, 60);
  assert.equal(mastodonLaenge("🇪🇺 x https://howtheyvote.eu/votes/198216"), 2 + 3 + 23);
});

test("Mastodon: Client lädt Bilder mit Alternativtext hoch und postet mit Token und Idempotency-Key", async () => {
  const aufrufe = [];
  const fetch = async (url, o) => {
    aufrufe.push({ url, o });
    const body = url.endsWith("/api/v2/media") ? { id: `m${aufrufe.length}` } : { id: "s1", scheduled_at: "x" };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const client = mastodonClient({ url: "https://masto.example", token: "geheim", fetch });
  const bilder = [{ daten: Buffer.from("a"), alt: "Grafik 1" }, { daten: Buffer.from("b"), alt: "Grafik 2" }];
  const datum = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const r = await mastodonPosten(client, abstimmung(), bilder, { datum, einstellungen: { inhaltswarnung: "EU-Politik: {titel}" } });
  assert.deepEqual(r, { id: "s1", geplant: true });
  assert.equal(aufrufe.length, 3);
  assert.equal(aufrufe[0].o.headers.Authorization, "Bearer geheim");
  assert.equal(aufrufe[0].o.body.get("description"), "Grafik 1");
  const status = aufrufe[2];
  assert.equal(status.url, "https://masto.example/api/v1/statuses");
  assert.equal(status.o.headers["Idempotency-Key"], "eu-piraten-198216");
  const body = JSON.parse(status.o.body);
  assert.deepEqual(body.media_ids, ["m1", "m2"]);
  assert.equal(body.visibility, "unlisted");
});

test("Mastodon: Fehler der API werden mit Status gemeldet", async () => {
  const client = mastodonClient({ url: "https://masto.example", token: "t", fetch: async () => new Response('{"error":"Validation failed"}', { status: 422 }) });
  await assert.rejects(client.statusAnlegen({ status: "x" }), /Mastodon POST \/api\/v1\/statuses: HTTP 422 .*Validation failed/);
});

test("Mastodon direkt: Zugang aus der Umgebung, Postiz-Mastodon-Kanäle fallen weg und /kanaele sagt es", () => {
  assert.equal(mastodonAusUmgebung({}), null);
  assert.equal(mastodonAusUmgebung({ MASTODON_URL: "https://m.example" }), null);
  assert.deepEqual(mastodonAusUmgebung({ MASTODON_URL: "https://m.example/ ", MASTODON_TOKEN: " t " }), { url: "https://m.example", token: "t" });

  const alle = [
    { id: "1", name: "Piraten-Check EU", identifier: "x" },
    { id: "2", name: "Piraten-Check EU Masto", identifier: "mastodon" },
  ];
  assert.deepEqual(ohnePostizMastodon(alle).map((k) => k.id), ["1"]);
  const text = kanalUebersicht(alle, { kanaele: ["1", "2"] }, { konto: "piratencheckeu", einstellungen: { sichtbarkeit: "unlisted", inhaltswarnung: "EU-Politik: {titel}" } });
  assert.match(text, /✅ Piraten-Check EU \(x/);
  assert.match(text, /POSTIZ_KUNDE: \(leer\)\nPOSTIZ_KANAELE: „1“, „2“/);
  assert.match(text, /⬜ Piraten-Check EU Masto \(mastodon\) – übersprungen, Mastodon läuft direkt/);
  assert.match(text, /✅ Mastodon direkt: @piratencheckeu \(unlisted, Inhaltswarnung/);
});

test("Veröffentlichen: Mastodon-Fehler wird vermerkt, der Postiz-Post bleibt (kein Doppelpost beim nächsten Lauf)", async () => {
  const { veroeffentlichen } = await import("../lib/veroeffentlichen.mjs");
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const ordner = await mkdtemp(join(tmpdir(), "masto-"));
  const png = join(ordner, "1.png");
  await writeFile(png, "x");
  const pngs = { feed: [png], hoch: [png] };
  const postiz = { hochladen: async () => ({ id: "u", path: "p" }), beitragAnlegen: async () => [{ postId: "p1" }] };
  const kaputt = { hochladen: async () => { throw new Error("HTTP 503"); } };
  const datum = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const o = { stories: false };

  const e = await veroeffentlichen({ postiz, kanaele: [{ id: "1", identifier: "x" }], mastodon: { client: kaputt, einstellungen: {} } }, abstimmung(), pngs, { datum, typ: "schedule", o });
  assert.deepEqual(e.postiz, [{ postId: "p1" }]);
  assert.match(e.mastodonFehler, /503/);

  // Nur Mastodon, ohne Postiz-Kanäle; Entwürfe gibt es bei Mastodon nicht.
  const ok = { hochladen: async () => "m1", statusAnlegen: async () => ({ id: "s9" }) };
  const nur = await veroeffentlichen({ postiz, kanaele: [], mastodon: { client: ok, einstellungen: {} } }, abstimmung(), pngs, { datum, typ: "schedule", o });
  assert.deepEqual(nur.mastodon, { id: "s9", geplant: true });
  assert.equal(nur.postiz, undefined);
  const entwurf = await veroeffentlichen({ postiz, kanaele: [], mastodon: { client: ok, einstellungen: {} } }, abstimmung(), pngs, { datum, typ: "draft", o });
  assert.equal(entwurf.mastodon, undefined);
});
