// Holt Antworten aus Telegram ab (✅/❌/✏️ und Änderungen) und aktualisiert data/freigabe.json.
// Läuft ohne npm ci (nur fetch). Meldet über GITHUB_OUTPUT „arbeit=true“, wenn danach gepostet oder neu gerendert werden muss.
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { telegramClient } from "../lib/telegram.mjs";
import { updatesVerarbeiten, arbeitOffen, chatsAusUpdates } from "../lib/freigabe.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GITHUB_OUTPUT } = process.env;
if (!TELEGRAM_BOT_TOKEN) {
  console.log("TELEGRAM_BOT_TOKEN fehlt – keine Freigabe über Telegram.");
  process.exit(0);
}

const telegram = telegramClient({ token: TELEGRAM_BOT_TOKEN });
const zustand = JSON.parse(await readFile(pfad("data/freigabe.json"), "utf8").catch(() => '{"offset":0,"abstimmungen":{}}'));
const updates = await telegram.updates(zustand.offset);

if (!TELEGRAM_CHAT_ID) {
  // Einrichtung: dem Bot schreiben, dann steht hier die Chat-ID.
  console.log("TELEGRAM_CHAT_ID fehlt. Chats, die dem Bot geschrieben haben:");
  for (const c of chatsAusUpdates(updates)) console.log(`  ${c.id}  ${c.name}`);
  process.exit(0);
}

const aktionen = updatesVerarbeiten(zustand, updates, TELEGRAM_CHAT_ID);
for (const a of aktionen) {
  if (a.art === "callback") await telegram.callbackBeantworten(a.id, a.text);
  if (a.art === "knoepfeEntfernen") await telegram.knoepfeEntfernen(TELEGRAM_CHAT_ID, a.nachricht);
  if (a.art === "nachricht") {
    const extra = {};
    if (a.antwortAuf) extra.reply_parameters = { message_id: a.antwortAuf, allow_sending_without_reply: true };
    if (a.forceReply) extra.reply_markup = { force_reply: true, input_field_placeholder: "Neuer Titel oder position: dagegen" };
    const gesendet = await telegram.nachricht(TELEGRAM_CHAT_ID, a.text, extra);
    // Antworten auf diese Nachricht sollen derselben Abstimmung zugeordnet werden.
    if (a.merkenFuer) zustand.abstimmungen[a.merkenFuer].nachrichten.push(gesendet.message_id);
  }
}
await writeFile(pfad("data/freigabe.json"), JSON.stringify(zustand, null, 1) + "\n");

const arbeit = arbeitOffen(zustand);
console.log(`${updates.length} Updates, ${aktionen.length} Aktionen, Arbeit offen: ${arbeit}`);
if (GITHUB_OUTPUT) await appendFile(GITHUB_OUTPUT, `arbeit=${arbeit}\n`);
