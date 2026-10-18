import { test } from "node:test";
import assert from "node:assert/strict";
import { befehlAuswerten, mitAenderungen, updatesVerarbeiten, aktionenAusfuehren, arbeitOffen, chatsAusUpdates, vorschauText, knoepfe } from "../lib/freigabe.mjs";
import { naechsterTermin } from "../lib/veroeffentlichen.mjs";
import { telegramClient } from "../lib/telegram.mjs";

const CHAT = 4711;

function zustand() {
  return {
    offset: 0,
    abstimmungen: {
      "100": { status: "wartet", gesendet: "2026-10-18T08:00:00Z", nachrichten: [10, 11, 12], aenderungen: {} },
      "200": { status: "wartet", gesendet: "2026-10-18T08:00:00Z", nachrichten: [20, 21], aenderungen: {} },
    },
  };
}
const knopf = (uid, data, nachricht, chat = CHAT) => ({ update_id: uid, callback_query: { id: `cq${uid}`, data, message: { message_id: nachricht, chat: { id: chat } } } });
const antwort = (uid, text, auf, chat = CHAT) => ({ update_id: uid, message: { message_id: 900 + uid, text, chat: { id: chat }, reply_to_message: auf ? { message_id: auf } : undefined } });

test("Befehle: Titel, Position, Hinweis, Fehler", () => {
  assert.deepEqual(befehlAuswerten("Neuer Titel\nzweite Zeile"), { titel: "Neuer Titel zweite Zeile" });
  assert.deepEqual(befehlAuswerten("position: Dagegen\nhinweis: Wir lehnen Atomkraft ab"), { position: "AGAINST", hinweis: "Wir lehnen Atomkraft ab" });
  assert.deepEqual(befehlAuswerten("Titel: Kurz"), { titel: "Kurz" });
  assert.match(befehlAuswerten("position: vielleicht").fehler, /Unbekannte Position/);
  assert.ok(befehlAuswerten("   ").fehler);
});

test("Änderungen anwenden: abweichende Position mit Hinweis, gleiche Position wie Gregorová", () => {
  const a = { id: 1, titel: "Alt", referenzStimme: "FOR", piraten: { position: "FOR", quelle: "referenz", status: "pruefen", regel: "Kernenergie", hinweis: "prüfen" } };
  const geaendert = mitAenderungen(a, { titel: "Neu", position: "AGAINST", hinweis: "Atomkraft nein" });
  assert.equal(geaendert.titel, "Neu");
  assert.deepEqual(geaendert.piraten, { position: "AGAINST", quelle: "regel", status: "automatisch", regel: "Freigabe", hinweis: "Atomkraft nein" });
  assert.equal(mitAenderungen(a, { position: "FOR" }).piraten.quelle, "referenz");
  assert.equal(a.titel, "Alt"); // Original bleibt unverändert
});

test("Ja / Nein per Knopf, Offset wird weitergezählt", () => {
  const z = zustand();
  const aktionen = updatesVerarbeiten(z, [knopf(5, "ja:100", 12), knopf(6, "nein:200", 21)], CHAT, new Date("2026-10-18T09:00:00Z"));
  assert.equal(z.offset, 7);
  assert.equal(z.abstimmungen["100"].status, "freigegeben");
  assert.equal(z.abstimmungen["100"].entschieden, "2026-10-18T09:00:00.000Z");
  assert.equal(z.abstimmungen["200"].status, "abgelehnt");
  assert.deepEqual(aktionen.filter((a) => a.art === "knoepfeEntfernen").map((a) => a.nachricht), [12, 21]);
  assert.ok(arbeitOffen(z));
});

test("Ändern: Knopf fragt nach, Antwort wird übernommen", () => {
  const z = zustand();
  const frage = updatesVerarbeiten(z, [knopf(1, "aendern:100", 12)], CHAT);
  assert.deepEqual(frage.find((a) => a.art === "nachricht"), { art: "nachricht", text: frage[1].text, antwortAuf: 12, merkenFuer: "100", forceReply: true });

  const aktionen = updatesVerarbeiten(z, [antwort(2, "position: dagegen", 11)], CHAT);
  assert.equal(z.abstimmungen["100"].status, "geaendert");
  assert.deepEqual(z.abstimmungen["100"].aenderungen, { position: "AGAINST" });
  assert.match(aktionen[0].text, /Übernommen:\nposition: Dagegen/);
});

test("Fremde Chats, veraltete Knöpfe und Nachrichten ohne Bezug", () => {
  const z = zustand();
  updatesVerarbeiten(z, [knopf(1, "ja:100", 12, 999), antwort(2, "Titel", 11, 999)], CHAT);
  assert.equal(z.abstimmungen["100"].status, "wartet");
  assert.deepEqual(z.abstimmungen["100"].aenderungen, {});

  z.abstimmungen["100"].status = "gepostet";
  const a = updatesVerarbeiten(z, [knopf(3, "ja:100", 12), antwort(4, "Titel", 11), antwort(5, "Hallo")], CHAT);
  assert.equal(a[0].text, "Schon erledigt oder veraltet.");
  assert.match(a[1].text, /schon gepostet/);
  assert.match(a[2].text, /antworte direkt auf eine Vorschau/);
  assert.equal(z.abstimmungen["100"].status, "gepostet");
});

test("Chat-IDs zum Einrichten", () => {
  assert.deepEqual(chatsAusUpdates([antwort(1, "hi", null, 42), antwort(2, "hi", null, 42)]).map((c) => c.id), [42]);
});

test("Vorschau: Warnung, Knöpfe, Originaltitel", () => {
  const a = {
    id: 7, titel: "Deutscher Titel", originaltitel: "English title", zeitpunkt: "2026-09-16 13:22:22", ergebnis: "ADOPTED",
    stimmen: { FOR: 625, AGAINST: 20, ABSTENTION: 22 }, deutschland: [{ partei: "CDU", mehrheit: "FOR" }],
    piraten: { position: "FOR", quelle: "referenz", status: "pruefen" },
  };
  const text = vorschauText(a, { warnung: "Bitte prüfen (Kernenergie)" });
  assert.match(text, /^🗳 Deutscher Titel\n16\.09\.2026 · angenommen \(625 : 20 : 22\)/);
  assert.match(text, /⚠️ Bitte prüfen \(Kernenergie\)/);
  assert.match(text, /Englischer Originaltitel: English title$/);
  assert.deepEqual(knoepfe(7).inline_keyboard[0].map((k) => k.callback_data), ["ja:7", "nein:7", "aendern:7"]);
});

test("Nächster Termin: frühestens in 10 Minuten, sonst nach dem letzten geplanten Post", () => {
  const jetzt = new Date("2026-10-18T12:00:00Z");
  assert.equal(naechsterTermin({}, { jetzt }), "2026-10-18T12:10:00.000Z");
  const gepostet = { 1: { typ: "schedule", zeitpunkt: "2026-10-18T13:00:00Z" }, 2: { typ: "draft", zeitpunkt: "2026-10-19T12:00:00Z" } };
  assert.equal(naechsterTermin(gepostet, { jetzt, abstandMinuten: 120 }), "2026-10-18T15:00:00.000Z");
});

test("Telegram: Bilder als Album, Fehler mit Beschreibung", async () => {
  const aufrufe = [];
  const fetch = async (url, opt) => {
    aufrufe.push({ url, opt });
    if (url.endsWith("/sendMessage")) return new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }));
    return new Response(JSON.stringify({ ok: true, result: [{ message_id: 1 }, { message_id: 2 }] }));
  };
  const t = telegramClient({ token: "T", fetch });
  const r = await t.bilder(CHAT, [{ daten: Buffer.from("a"), name: "1.png" }, { daten: Buffer.from("b"), name: "2.png" }]);
  assert.deepEqual(r.map((m) => m.message_id), [1, 2]);
  assert.equal(aufrufe[0].url, "https://api.telegram.org/botT/sendMediaGroup");
  const media = JSON.parse(aufrufe[0].opt.body.get("media"));
  assert.deepEqual(media.map((m) => m.media), ["attach://bild0", "attach://bild1"]);
  await assert.rejects(t.nachricht(CHAT, "x"), /chat not found/);
});

test("Befehle wie /status gehen an den Bot, auch mit @Botname", () => {
  const a = updatesVerarbeiten(zustand(), [antwort(1, "/status"), antwort(2, "/Jetzt@PiratenBot bitte")], CHAT);
  assert.deepEqual(a.map((x) => x.befehl), ["/status", "/jetzt"]);
});

test("Aktionen ausführen: Rückfrage wird der Abstimmung zugeordnet, Befehle kommen zurück", async () => {
  const gesendet = [];
  const telegram = {
    callbackBeantworten: async () => {},
    knoepfeEntfernen: async () => {},
    nachricht: async (chat, text, extra) => { gesendet.push({ chat, text, extra }); return { message_id: 77 }; },
  };
  const z = zustand();
  const aktionen = updatesVerarbeiten(z, [knopf(1, "aendern:100", 12), antwort(2, "/status")], CHAT);
  const befehle = await aktionenAusfuehren(telegram, CHAT, z, aktionen);
  assert.deepEqual(befehle.map((b) => b.befehl), ["/status"]);
  assert.deepEqual(z.abstimmungen["100"].nachrichten, [10, 11, 12, 77]);
  assert.equal(gesendet[0].extra.reply_markup.force_reply, true);
});
