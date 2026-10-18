import { test } from "node:test";
import assert from "node:assert/strict";
import { auswahlAusUmgebung, kanaeleAuswaehlen, kanalUebersicht } from "../lib/kanalauswahl.mjs";

const ALLE = [
  { id: "a1", name: "PIRATEN Bayern", identifier: "x", profile: "piratenbayern", customer: { id: "k1", name: "EU-Abstimmungen" } },
  { id: "a2", name: "Piraten EU", identifier: "mastodon", profile: "piraten_eu", customer: { id: "k1", name: "EU-Abstimmungen" } },
  { id: "a3", name: "Mein privater Account", identifier: "bluesky", profile: "privat" },
  { id: "a4", name: "Stadtrat", identifier: "instagram", profile: "stadtrat" },
  { id: "a5", name: "YouTube Kanal", identifier: "youtube", profile: "yt", customer: { id: "k1", name: "EU-Abstimmungen" } },
];

test("Umgebung: Liste und Kunde", () => {
  assert.deepEqual(auswahlAusUmgebung({ POSTIZ_KANAELE: " Piraten EU, a4 ,,", POSTIZ_KUNDE: " " }), { kanaele: ["Piraten EU", "a4"], kunde: null });
  assert.deepEqual(auswahlAusUmgebung({}), { kanaele: [], kunde: null });
});

test("Ohne Auswahl wird nichts gepostet", () => {
  const r = kanaeleAuswaehlen(ALLE, { kanaele: [], kunde: null });
  assert.deepEqual(r.ausgewaehlt, []);
  assert.match(r.fehler, /Keine Kanäle ausgewählt/);
});

test("Auswahl per Name, Profil oder ID – ohne Rücksicht auf Groß-/Kleinschreibung und @", () => {
  const r = kanaeleAuswaehlen(ALLE, { kanaele: ["piraten eu", "@PiratenBayern", "a4", "Gibt es nicht"] });
  assert.deepEqual(r.ausgewaehlt.map((k) => k.id), ["a1", "a2", "a4"]);
  assert.deepEqual(r.nichtGefunden, ["Gibt es nicht"]);
});

test("Auswahl per Kunde; nicht unterstützte Kanäle werden gemeldet, privater Account bleibt außen vor", () => {
  const r = kanaeleAuswaehlen(ALLE, { kunde: "eu-abstimmungen" });
  assert.deepEqual(r.ausgewaehlt.map((k) => k.id), ["a1", "a2"]);
  assert.deepEqual(r.nichtUnterstuetzt.map((k) => k.id), ["a5"]);
  assert.ok(!r.ausgewaehlt.some((k) => k.id === "a3"));
  assert.deepEqual(kanaeleAuswaehlen(ALLE, { kunde: "Unbekannt" }).nichtGefunden, ["Kunde „Unbekannt“"]);
});

test("Übersicht für /kanaele markiert die Auswahl", () => {
  const text = kanalUebersicht(ALLE, { kanaele: ["a2"] });
  assert.match(text, /✅ Piraten EU \(mastodon, @piraten_eu, Kunde: EU-Abstimmungen\)\n {4}ID: a2/);
  assert.match(text, /⬜ Mein privater Account \(bluesky, @privat\)/);
  assert.match(kanalUebersicht(ALLE, {}), /⚠️ Keine Kanäle ausgewählt/);
});
