// Freigabe über Telegram: jede Abstimmung kommt als Vorschau mit ✅ Ja / ❌ Nein / ✏️ Ändern,
// gepostet wird erst nach „Ja“. Der Bot (scripts/bot.mjs) holt die Antworten ab.
//
// Zustand in daten/freigabe.json:
//   { offset, abstimmungen: { [id]: { status, gesendet, nachrichten: [ids], aenderungen: { titel, position, hinweis } } } }
// status: wartet → freigegeben → gepostet, oder abgelehnt; „geaendert“ = neue Vorschau nötig.
import { posttextLang, posttextKurz, MESSEN } from "./posttext.mjs";
import { POSITIONEN } from "./parteien.mjs";

const POSITION_WOERTER = {
  "dafür": "FOR", "dafuer": "FOR", "ja": "FOR", "für": "FOR",
  "dagegen": "AGAINST", "nein": "AGAINST", "gegen": "AGAINST",
  "enthaltung": "ABSTENTION", "enthalten": "ABSTENTION",
};

// Antwort auf eine Vorschau auswerten. Ohne „titel:/position:/hinweis:“ ist der ganze Text der neue Titel.
export function befehlAuswerten(text) {
  const ergebnis = {};
  let erkannt = false;
  for (const zeile of (text ?? "").split("\n").map((z) => z.trim()).filter(Boolean)) {
    const m = zeile.match(/^(titel|position|hinweis|erkl(?:ae|ä)rung)\s*:\s*(.+)$/i);
    if (!m) continue;
    erkannt = true;
    const [, schluessel, wert] = m;
    if (/^erkl/i.test(schluessel)) {
      // „erklaerung: aus“ blendet die Zusammenfassung aus, sonst ist jede Zeile ein eigener Stichpunkt.
      if (wert.trim().toLowerCase() === "aus") ergebnis.erklaerung = false;
      else if (ergebnis.erklaerung !== false) ergebnis.erklaerung = [...(ergebnis.erklaerung || []), wert.trim()];
    } else if (schluessel.toLowerCase() === "position") {
      const pos = POSITION_WOERTER[wert.trim().toLowerCase()];
      if (!pos) return { fehler: `Unbekannte Position „${wert.trim()}“ – erlaubt: dafür, dagegen, enthaltung` };
      ergebnis.position = pos;
    } else {
      ergebnis[schluessel.toLowerCase()] = wert.trim();
    }
  }
  if (!erkannt && text?.trim()) ergebnis.titel = text.trim().replace(/\s*\n\s*/g, " ");
  return Object.keys(ergebnis).length ? ergebnis : { fehler: "Keine Änderung erkannt." };
}

// Wendet Änderungen aus Telegram auf eine Abstimmung an (Titel, Piraten-Position, Hinweis, Erklärung).
export function mitAenderungen(abstimmung, aenderungen = {}) {
  const a = { ...abstimmung, piraten: { ...abstimmung.piraten } };
  if (aenderungen.titel) a.titel = aenderungen.titel;
  if (aenderungen.position) {
    const wieReferenz = aenderungen.position === abstimmung.referenzStimme;
    a.piraten = wieReferenz
      ? { position: aenderungen.position, quelle: "referenz", status: "automatisch", regel: null }
      : {
          position: aenderungen.position,
          quelle: "regel",
          status: "automatisch",
          regel: "Freigabe",
          hinweis: aenderungen.hinweis ?? abstimmung.piraten.hinweis ?? "Position der deutschen PIRATEN.",
        };
  } else if (aenderungen.hinweis && a.piraten.quelle === "regel") {
    a.piraten.hinweis = aenderungen.hinweis;
  }
  // Erklärung: false = ausblenden, Liste = eigene Stichpunkte statt der KI-Zusammenfassung.
  if (aenderungen.erklaerung === false) a.zusammenfassung = null;
  else if (Array.isArray(aenderungen.erklaerung)) {
    a.zusammenfassung = aenderungen.erklaerung;
    a.erklaerungEigen = true;
  }
  return a;
}

export function knoepfe(id) {
  return {
    inline_keyboard: [[
      { text: "✅ Ja, posten", callback_data: `ja:${id}` },
      { text: "❌ Nein", callback_data: `nein:${id}` },
      { text: "✏️ Ändern", callback_data: `aendern:${id}` },
    ]],
  };
}

export const ANLEITUNG_AENDERN = [
  "Antworte auf diese Nachricht mit:",
  "• einem neuen Titel (einfach als Text), oder",
  "• position: dafür / dagegen / enthaltung",
  "• hinweis: Begründung, warum die PIRATEN anders stimmen als Gregorová",
  "• erklaerung: eigener Text für „Worum geht es?“ (jede Zeile ein Stichpunkt)",
  "• erklaerung: aus – Zusammenfassung weglassen",
  "Mehrere Zeilen gehen auch.",
].join("\n");

// Text der Vorschau-Nachricht (Telegram erlaubt 4096 Zeichen).
export function vorschauText(a, { warnung } = {}) {
  const ergebnis = { ADOPTED: "angenommen", REJECTED: "abgelehnt" }[a.ergebnis] ?? a.ergebnis;
  const s = a.stimmen;
  const quelle = a.piraten.quelle === "regel" ? `abweichend von Gregorová: ${a.piraten.hinweis}` : "wie Markéta Gregorová";
  const zeilen = [
    `🗳 ${a.titel}`,
    `${a.zeitpunkt.slice(8, 10)}.${a.zeitpunkt.slice(5, 7)}.${a.zeitpunkt.slice(0, 4)} · ${ergebnis} (${s.FOR} : ${s.AGAINST} : ${s.ABSTENTION})`,
    `🏴‍☠️ PIRATEN: ${POSITIONEN[a.piraten.position]} (${quelle})`,
  ];
  if (warnung) zeilen.push(`⚠️ ${warnung}`);
  if (a.zusammenfassung?.length) {
    zeilen.push("", a.erklaerungEigen
      ? "── Worum geht es? (eigener Text, steht auf der Übersicht) ──"
      : "── Worum geht es? (KI-Zusammenfassung von check-some-votes, steht auf der Übersicht) ──");
    for (const p of a.zusammenfassung) zeilen.push(`• ${p}`);
  }
  zeilen.push(
    "",
    "── Posttext (Mastodon, Instagram, Facebook, TikTok) ──",
    posttextLang(a),
    "",
    "── Kurzfassung (X, Bluesky, Threads) ──",
    posttextKurz(a, 280, MESSEN.utf16),
    "",
    `Englischer Originaltitel: ${a.originaltitel ?? a.titel}`,
  );
  return zeilen.join("\n").slice(0, 4096);
}

// Verarbeitet Telegram-Updates. Ändert `zustand` und gibt die nötigen Telegram-Aktionen zurück.
export function updatesVerarbeiten(zustand, updates, chatId, jetzt = new Date()) {
  const aktionen = [];
  const eintragZu = (nachrichtId) =>
    Object.entries(zustand.abstimmungen).find(([, e]) => e.nachrichten?.includes(nachrichtId));

  for (const u of updates) {
    zustand.offset = u.update_id + 1;

    if (u.callback_query) {
      const cq = u.callback_query;
      const chat = cq.message?.chat?.id;
      if (String(chat) !== String(chatId)) continue; // nur der eingerichtete Chat darf freigeben
      const [art, id] = (cq.data ?? "").split(":");
      const e = zustand.abstimmungen[id];
      if (!e || e.status !== "wartet") {
        aktionen.push({ art: "callback", id: cq.id, text: "Schon erledigt oder veraltet." });
        continue;
      }
      const nachricht = cq.message.message_id;
      if (art === "ja") {
        e.status = "freigegeben";
        e.entschieden = jetzt.toISOString();
        aktionen.push({ art: "callback", id: cq.id, text: "Freigegeben" });
        aktionen.push({ art: "knoepfeEntfernen", nachricht });
        aktionen.push({ art: "nachricht", text: "✅ Freigegeben – wird jetzt in Postiz eingeplant.", antwortAuf: nachricht });
      } else if (art === "nein") {
        e.status = "abgelehnt";
        aktionen.push({ art: "callback", id: cq.id, text: "Abgelehnt" });
        aktionen.push({ art: "knoepfeEntfernen", nachricht });
        aktionen.push({ art: "nachricht", text: "❌ Abgelehnt – wird nicht gepostet.", antwortAuf: nachricht });
      } else if (art === "aendern") {
        aktionen.push({ art: "callback", id: cq.id, text: "Was soll sich ändern?" });
        aktionen.push({ art: "nachricht", text: ANLEITUNG_AENDERN, antwortAuf: nachricht, merkenFuer: id, forceReply: true });
      }
      continue;
    }

    const m = u.message;
    if (!m || String(m.chat?.id) !== String(chatId)) continue;
    const ziel = m.reply_to_message && eintragZu(m.reply_to_message.message_id);
    if (!ziel && m.text?.startsWith("/")) {
      // /status, /jetzt … – die führt der Bot aus (scripts/bot.mjs).
      aktionen.push({ art: "befehl", befehl: m.text.split(/[\s@]/)[0].toLowerCase(), antwortAuf: m.message_id });
      continue;
    }
    if (!ziel) {
      aktionen.push({ art: "nachricht", text: "Bitte antworte direkt auf eine Vorschau (oder nutze die Knöpfe)." });
      continue;
    }
    const [id, e] = ziel;
    if (!["wartet", "geaendert"].includes(e.status)) {
      aktionen.push({ art: "nachricht", text: `Diese Abstimmung ist schon ${e.status}.`, antwortAuf: m.message_id });
      continue;
    }
    const befehl = befehlAuswerten(m.text);
    if (befehl.fehler) {
      aktionen.push({ art: "nachricht", text: `⚠️ ${befehl.fehler}\n\n${ANLEITUNG_AENDERN}`, antwortAuf: m.message_id, merkenFuer: id, forceReply: true });
      continue;
    }
    e.aenderungen = { ...e.aenderungen, ...befehl };
    e.status = "geaendert";
    const anzeige = (k, v) =>
      k === "position" ? POSITIONEN[v] : k === "erklaerung" ? (v === false ? "aus" : v.map((p) => `\n• ${p}`).join("")) : v;
    const was = Object.entries(befehl).map(([k, v]) => `${k}: ${anzeige(k, v)}`).join("\n");
    aktionen.push({ art: "nachricht", text: `✏️ Übernommen:\n${was}\n\nNeue Vorschau kommt gleich.`, antwortAuf: m.message_id });
  }
  return aktionen;
}

// Führt die Aktionen aus updatesVerarbeiten aus (außer Befehlen, die gibt sie zurück).
export async function aktionenAusfuehren(telegram, chatId, zustand, aktionen) {
  const befehle = [];
  for (const a of aktionen) {
    if (a.art === "befehl") befehle.push(a);
    if (a.art === "callback") await telegram.callbackBeantworten(a.id, a.text);
    if (a.art === "knoepfeEntfernen") await telegram.knoepfeEntfernen(chatId, a.nachricht);
    if (a.art === "nachricht") {
      const extra = {};
      if (a.antwortAuf) extra.reply_parameters = { message_id: a.antwortAuf, allow_sending_without_reply: true };
      if (a.forceReply) extra.reply_markup = { force_reply: true, input_field_placeholder: "Neuer Titel oder position: dagegen" };
      const gesendet = await telegram.nachricht(chatId, a.text, extra);
      // Antworten auf diese Nachricht sollen derselben Abstimmung zugeordnet werden.
      if (a.merkenFuer) zustand.abstimmungen[a.merkenFuer].nachrichten.push(gesendet.message_id);
    }
  }
  return befehle;
}

// /neu: alle wartenden Vorschauen mit aktuellen Grafiken noch einmal schicken. Gibt die Anzahl zurück.
export function alleNeuVorlegen(zustand) {
  const wartend = Object.values(zustand.abstimmungen).filter((e) => e.status === "wartet");
  for (const e of wartend) e.status = "geaendert";
  return wartend.length;
}

// Gibt es etwas zu tun, wofür Grafiken oder Postiz gebraucht werden?
export function arbeitOffen(zustand) {
  return Object.values(zustand.abstimmungen).some((e) => ["freigegeben", "geaendert"].includes(e.status));
}

// Chats, die dem Bot geschrieben haben – hilft beim Einrichten von TELEGRAM_CHAT_ID.
export function chatsAusUpdates(updates) {
  const chats = new Map();
  for (const u of updates) {
    const chat = u.message?.chat ?? u.callback_query?.message?.chat;
    if (chat) chats.set(chat.id, chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(" ") ?? chat.username);
  }
  return [...chats].map(([id, name]) => ({ id, name }));
}
