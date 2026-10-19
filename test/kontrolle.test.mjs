import { test } from "node:test";
import assert from "node:assert/strict";
import { erwartetePosts, faelligeKontrollen, abfragezeitraum, auswerten } from "../lib/kontrolle.mjs";
import { postizClient } from "../lib/postiz.mjs";

const JETZT = new Date("2026-10-19T09:00:00Z");
const vor = (min) => new Date(JETZT.getTime() - min * 60000).toISOString();
const gepostet = {
  "101": { typ: "schedule", zeitpunkt: vor(60), postiz: [{ postId: "a", integration: "x" }, { postId: "b", integration: "bsky" }], story: [{ postId: "s" }] },
  "102": { typ: "schedule", zeitpunkt: vor(5), postiz: [{ postId: "c" }] },          // noch in der Karenz
  "103": { typ: "draft", zeitpunkt: vor(60), postiz: [{ postId: "d" }] },            // Entwurf: nie kontrollieren
  "104": { typ: "schedule", zeitpunkt: vor(5 * 24 * 60), postiz: [{ postId: "e" }] }, // zu alt
};
const post = (id, state, extra = {}) => ({
  id, state, publishDate: vor(60), content: "<p>🇪🇺 EU-Parlament, 08.10.2026</p><p>Pilotprojekt zu Schulallianzen</p>",
  integration: { providerIdentifier: "x", name: "Piraten-Check EU" }, ...extra,
});

test("Kontrolle: nur eingeplante Posts nach Ablauf der Karenz und nicht älter als 3 Tage", () => {
  const erwartet = erwartetePosts(gepostet);
  assert.deepEqual([...erwartet.keys()].sort(), ["a", "b", "c", "e", "s"]);
  const faellig = faelligeKontrollen(erwartet, { erledigt: { s: true } }, JETZT);
  assert.deepEqual(faellig.map(([id]) => id).sort(), ["a", "b"]);
  const z = abfragezeitraum(faellig, JETZT);
  assert.ok(Date.parse(z.startDate) < Date.parse(vor(60)) && Date.parse(z.endDate) > JETZT.getTime());
});

test("Kontrolle: hängende Posts einmal melden, Fehler mit Grund, Nachgeholtes bestätigen", () => {
  const kontrolle = { erledigt: {}, gemeldet: {} };
  const faellig = faelligeKontrollen(erwartetePosts(gepostet), kontrolle, JETZT);

  let texte = auswerten([post("a", "QUEUE"), post("b", "ERROR", { error: "Invalid identifier or password", integration: { providerIdentifier: "bluesky", name: "Piraten-Check EU" } })], faellig, kontrolle, JETZT);
  assert.equal(texte.length, 1);
  assert.match(texte[0], /2 Posts nicht veröffentlicht/);
  assert.match(texte[0], /X \(Piraten-Check EU\), geplant .*wartet seit 60 Minuten/);
  assert.match(texte[0], /Bluesky \(Piraten-Check EU\).*Fehler – Invalid identifier or password/);
  assert.match(texte[0], /Pilotprojekt zu Schulallianzen/);
  assert.match(texte[0], /neu verbunden/);

  // Beim nächsten Durchlauf nicht noch einmal melden.
  assert.deepEqual(auswerten([post("a", "QUEUE"), post("b", "ERROR")], faellig, kontrolle, JETZT), []);

  // Nachgeholt → Bestätigung, danach erledigt.
  texte = auswerten([post("a", "PUBLISHED"), post("b", "ERROR")], faellig, kontrolle, JETZT);
  assert.equal(texte.length, 1);
  assert.match(texte[0], /✅ Inzwischen veröffentlicht:\n• X \(Piraten-Check EU\)/);
  assert.equal(kontrolle.erledigt.a, true);
  assert.equal(kontrolle.gemeldet.a, undefined);
});

test("Kontrolle: nur hängende Posts → Hinweis auf den Orchestrator; Pünktliches und Gelöschtes still erledigt", () => {
  const kontrolle = {};
  const faellig = faelligeKontrollen(erwartetePosts(gepostet), kontrolle, JETZT);
  const texte = auswerten([post("a", "QUEUE")], faellig, kontrolle, JETZT);
  assert.match(texte[0], /einen Post nicht veröffentlicht/);
  assert.match(texte[0], /Orchestrator.*\n.*docker restart postiz/);
  assert.equal(kontrolle.erledigt.b, true); // in Postiz gelöscht

  const k2 = {};
  assert.deepEqual(auswerten([post("a", "PUBLISHED"), post("b", "PUBLISHED")], faellig, k2, JETZT), []);
  assert.deepEqual(k2.erledigt, { a: true, b: true, s: true }); // s: Story, in Postiz nicht (mehr) da

  // In Postiz auf später verschoben: noch nicht überfällig, also keine Meldung.
  const k3 = {};
  assert.deepEqual(auswerten([post("a", "QUEUE", { publishDate: new Date(JETZT.getTime() + 3600e3).toISOString() }), post("b", "PUBLISHED")], faellig, k3, JETZT), []);
  assert.equal(k3.erledigt.a, undefined);
});

test("Postiz-Client: Posts im Zeitraum abfragen", async () => {
  let url;
  const fetch = async (u) => { url = u; return new Response(JSON.stringify({ posts: [{ id: "a", state: "QUEUE" }] })); };
  const posts = await postizClient({ url: "https://postiz.example", apiKey: "k", fetch }).posts({ startDate: "2026-10-18T00:00:00.000Z", endDate: "2026-10-20T00:00:00.000Z" });
  assert.deepEqual(posts, [{ id: "a", state: "QUEUE" }]);
  assert.equal(url, "https://postiz.example/api/public/v1/posts?startDate=2026-10-18T00%3A00%3A00.000Z&endDate=2026-10-20T00%3A00%3A00.000Z");
});

test("/neu: Abstimmungen, deren Posts in Postiz alle gelöscht sind, kommen zurück", async () => {
  const { suchzeitraum, geloeschteAbstimmungen } = await import("../lib/kontrolle.mjs");
  const g = {
    "201": { typ: "schedule", zeitpunkt: vor(120), postiz: [{ postId: "p1" }, { postId: "p2" }], story: [{ postId: "p3" }] }, // alles gelöscht
    "202": { typ: "schedule", zeitpunkt: vor(60), postiz: [{ postId: "q1" }, { postId: "q2" }] },                          // einer noch da
    "203": { typ: "schedule", zeitpunkt: new Date(JETZT.getTime() + 3600e3).toISOString(), postiz: [{ postId: "r1" }] },  // künftig, gelöscht
    "204": { typ: "schedule", zeitpunkt: vor(10 * 24 * 60), postiz: [{ postId: "alt" }] },                                // zu alt
    "205": { typ: "draft", zeitpunkt: vor(60), postiz: [{ postId: "d1" }] },
    "206": { typ: "schedule", zeitpunkt: vor(60), mastodon: { id: "m" } },                                                  // ohne Postiz
  };
  const z = suchzeitraum(g, JETZT);
  assert.ok(Date.parse(z.startDate) < Date.parse(vor(120)));
  assert.ok(Date.parse(z.endDate) > JETZT.getTime() + 30 * 864e5);
  assert.deepEqual(geloeschteAbstimmungen(g, [{ id: "q2", state: "PUBLISHED" }], JETZT), ["201", "203"]);
  assert.equal(suchzeitraum({ "204": g["204"] }, JETZT), null);
});
