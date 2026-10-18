// Dauerhaft laufender Dienst (z. B. auf dem Raspberry Pi, siehe pi/):
// - hält die Verbindung zu Telegram offen und reagiert sofort auf ✅/❌/✏️ und Befehle,
// - startet einmal täglich (config.json → zeitplan) Abruf, Auswertung, Titel, Porträts und neue Vorschläge,
// - plant Freigegebenes in Postiz ein.
// Die eigentliche Arbeit machen die Skripte in scripts/ als eigene Prozesse.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { telegramClient } from "../lib/telegram.mjs";
import { updatesVerarbeiten, aktionenAusfuehren, arbeitOffen, chatsAusUpdates } from "../lib/freigabe.mjs";
import { faellig, heute } from "../lib/zeitplan.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const json = async (p, standard) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => JSON.stringify(standard)));
const speichern = (p, daten) => writeFile(pfad(p), JSON.stringify(daten, null, 1) + "\n");
const warten = (ms) => new Promise((r) => setTimeout(r, ms));

const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN fehlt (siehe pi/umgebung.beispiel).");
await mkdir(pfad("daten"), { recursive: true });

const config = await json("config.json");
const { taeglich: uhrzeit, zeitzone } = config.zeitplan;
const telegram = telegramClient({ token: TELEGRAM_BOT_TOKEN });
const leer = { offset: 0, abstimmungen: {} };

const HILFE = [
  "Ich schlage täglich Abstimmungen vor. Zu jeder Vorschau: ✅ Ja, ❌ Nein oder ✏️ Ändern.",
  "",
  "/status – was gerade offen ist",
  "/jetzt – den täglichen Lauf sofort starten",
].join("\n");

// Startet scripts/<name>.mjs; bei Fehler kommen die letzten Zeilen per Telegram.
function schritt(name, args = []) {
  return new Promise((ok, fehler) => {
    console.log(`▶ ${name} ${args.join(" ")}`);
    const kind = spawn(process.execPath, [pfad(`scripts/${name}.mjs`), ...args], { env: process.env });
    const ende = [];
    const mitschreiben = (ziel) => (d) => {
      ziel.write(d);
      ende.push(...String(d).split("\n").filter(Boolean));
      ende.splice(0, Math.max(0, ende.length - 8));
    };
    kind.stdout.on("data", mitschreiben(process.stdout));
    kind.stderr.on("data", mitschreiben(process.stderr));
    kind.on("close", (code) => (code === 0 ? ok() : fehler(new Error(`${name} ist fehlgeschlagen (Code ${code}):\n${ende.join("\n")}`))));
  });
}

async function melden(text) {
  console.error(text);
  if (TELEGRAM_CHAT_ID) await telegram.nachricht(TELEGRAM_CHAT_ID, text.slice(0, 4000)).catch((e) => console.error(e.message));
}

async function taeglicherLauf() {
  const bot = await json("daten/bot.json", {});
  bot.letzterLauf = heute(new Date(), zeitzone);
  await speichern("daten/bot.json", bot);

  // Titel dürfen fehlschlagen (check-some-votes nicht erreichbar) – gepostet wird dann, was schon einen hat.
  const schritte = [["abrufen"], ["auswerten"], ["titel", [], true], ["portraets"], ["posten", ["--neue"]]];
  for (const [name, args = [], optional = false] of schritte) {
    try {
      await schritt(name, args);
    } catch (e) {
      await melden(`⚠️ Täglicher Lauf: ${e.message}`);
      if (!optional) return;
    }
  }
}

let naechsterPostVersuch = 0;
async function offenesErledigen() {
  if (!arbeitOffen(await json("daten/freigabe.json", leer)) || Date.now() < naechsterPostVersuch) return;
  try {
    await schritt("posten");
  } catch (e) {
    await melden(`⚠️ Einplanen: ${e.message}`);
  }
  // Bleibt etwas offen (z. B. Postiz-Stundenlimit), erst in 10 Minuten wieder versuchen.
  naechsterPostVersuch = arbeitOffen(await json("daten/freigabe.json", leer)) ? Date.now() + 10 * 60 * 1000 : 0;
}

async function status() {
  const z = await json("daten/freigabe.json", leer);
  const gepostet = await json("daten/gepostet.json", {});
  const { stand } = await json("daten/abstimmungen.json", {});
  const bot = await json("daten/bot.json", {});
  const anzahl = (s) => Object.values(z.abstimmungen).filter((e) => e.status === s).length;
  const woche = Object.values(gepostet).filter((g) => g.typ === "schedule" && Date.now() - Date.parse(g.zeitpunkt) < 7 * 864e5).length;
  return [
    `⏳ warten auf Freigabe: ${anzahl("wartet")}`,
    `✏️ geändert, neue Vorschau kommt: ${anzahl("geaendert")}`,
    `✅ freigegeben, noch nicht eingeplant: ${anzahl("freigegeben")}`,
    `📅 eingeplant in den letzten 7 Tagen: ${woche}`,
    "",
    `Daten von HowTheyVote: ${stand ?? "noch keine"}`,
    `Letzter täglicher Lauf: ${bot.letzterLauf ?? "noch keiner"} (täglich ab ${uhrzeit} Uhr)`,
  ].join("\n");
}

console.log(`Bot läuft. Täglicher Lauf ab ${uhrzeit} (${zeitzone}).`);
if (!TELEGRAM_CHAT_ID) console.log("TELEGRAM_CHAT_ID fehlt – schreib dem Bot, er antwortet mit der Chat-ID.");

for (;;) {
  if (TELEGRAM_CHAT_ID && faellig(new Date(), (await json("daten/bot.json", {})).letzterLauf, uhrzeit, zeitzone)) {
    await taeglicherLauf();
  }

  const zustand = await json("daten/freigabe.json", leer);
  let updates;
  try {
    updates = await telegram.updates(zustand.offset, 50);
  } catch (e) {
    console.error(`Telegram: ${e.message} – neuer Versuch in 30 s`);
    await warten(30_000);
    continue;
  }

  if (!TELEGRAM_CHAT_ID) {
    // Einrichtung: jedem, der schreibt, die eigene Chat-ID nennen.
    for (const c of chatsAusUpdates(updates)) {
      console.log(`Chat ${c.id} (${c.name})`);
      await telegram.nachricht(c.id, `Deine Chat-ID: ${c.id}\nTrage sie als TELEGRAM_CHAT_ID ein und starte den Dienst neu.`);
    }
    if (updates.length) await speichern("daten/freigabe.json", { ...zustand, offset: updates.at(-1).update_id + 1 });
    continue;
  }

  if (updates.length) {
    const aktionen = updatesVerarbeiten(zustand, updates, TELEGRAM_CHAT_ID);
    const befehle = await aktionenAusfuehren(telegram, TELEGRAM_CHAT_ID, zustand, aktionen);
    await speichern("daten/freigabe.json", zustand);
    for (const b of befehle) {
      const antwort = (text) => telegram.nachricht(TELEGRAM_CHAT_ID, text, { reply_parameters: { message_id: b.antwortAuf, allow_sending_without_reply: true } });
      if (b.befehl === "/status") await antwort(await status());
      else if (b.befehl === "/jetzt") {
        await antwort("🔄 Starte den täglichen Lauf …");
        await taeglicherLauf();
        await antwort("✔️ Fertig.");
      } else await antwort(HILFE);
    }
  }

  await offenesErledigen();
}
