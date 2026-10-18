// Postet Abstimmungen über Postiz – mit Freigabe über Telegram, wenn TELEGRAM_BOT_TOKEN und TELEGRAM_CHAT_ID gesetzt sind.
//
//   npm run posten -- --neue      neue Abstimmungen auswählen (täglich)
//   npm run posten                nur Offenes erledigen: Freigegebenes einplanen, Geändertes neu vorlegen
//   npm run posten -- --trocken   nur Vorschau, nichts wird verschickt
//
// Mit Telegram:  neue Abstimmungen → Vorschau mit ✅/❌/✏️ (data/freigabe.json); erst nach ✅ geht es an Postiz.
// Ohne Telegram: „automatisch“ → geplanter Post, „pruefen“ → Entwurf in Postiz.
// Ohne deutschen Titel (data/titel.json oder data/titel_auto.json) wird nichts vorgeschlagen.
// Bereits Gepostetes steht in data/gepostet.json und wird nie doppelt angelegt.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { auswahl } from "../lib/auswahl.mjs";
import { beitrag } from "../lib/beitrag.mjs";
import { grafikenRendern, mitDeutschemTitel, deutscheTitel } from "../lib/render.mjs";
import { postizVerbinden, passtInsLimit, veroeffentlichen, naechsterTermin } from "../lib/veroeffentlichen.mjs";
import { telegramClient } from "../lib/telegram.mjs";
import { mitAenderungen, vorschauText, knoepfe } from "../lib/freigabe.mjs";

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
const json = async (p, standard) => JSON.parse(await readFile(pfad(p), "utf8").catch(() => JSON.stringify(standard)));
const speichern = (p, daten) => writeFile(pfad(p), JSON.stringify(daten, null, 1) + "\n");

const config = await json("config.json");
const { abstimmungen } = await json("data/abstimmungen.json");
const personen = await json("data/abgeordnete.json");
const gepostet = await json("data/gepostet.json", {});
const freigabe = await json("data/freigabe.json", { offset: 0, abstimmungen: {} });
const o = config.posten;

const { POSTIZ_URL, POSTIZ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
const mitTelegram = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
const trocken = process.argv.includes("--trocken");
const neue = process.argv.includes("--neue") || !mitTelegram;
const nachId = new Map(abstimmungen.map((a) => [String(a.id), a]));

// ── 1. Neue Kandidaten ───────────────────────────────────────────────
let kandidaten = [];
if (neue) {
  const titel = await deutscheTitel();
  // Mit Telegram zählt jeder Vorschlag aufs Tages-/Wochenlimit, und Vorgeschlagenes wird nicht erneut vorgeschlagen.
  const belegt = mitTelegram
    ? { ...gepostet, ...Object.fromEntries(Object.entries(freigabe.abstimmungen).map(([id, e]) => [id, { typ: "vorschlag", zeitpunkt: e.gesendet }])) }
    : gepostet;
  const r = auswahl(abstimmungen, belegt, {
    proTag: o.pro_tag, proWoche: o.pro_woche, maxAlterTage: o.max_alter_tage,
    hatTitel: (a) => Boolean(titel[a.id]),
    zaehlt: mitTelegram ? (g) => g.typ === "vorschlag" : undefined,
  });
  if (r.ohneTitel.length) {
    console.log(`\n${r.ohneTitel.length} Abstimmungen ohne deutschen Titel (check-some-votes.eu hatte keinen) – bei Bedarf in data/titel.json eintragen:`);
    for (const a of r.ohneTitel) console.log(`  "${a.id}": "",   // ${a.zeitpunkt.slice(0, 10)} ${a.titel}`);
    console.log();
  }
  // Mit Telegram gehen auch Prüffälle (z. B. Kernenergie) als Vorschau raus, mit Warnung; alle zählen aufs Limit.
  kandidaten = mitTelegram
    ? r.kandidaten.slice(0, r.frei)
    : [...r.posten.map((a) => ({ ...a, typ: "schedule" })), ...r.entwuerfe.map((a) => ({ ...a, typ: "draft" }))];
  console.log(`${kandidaten.length} neue Abstimmungen${mitTelegram ? " zur Freigabe" : ""}`);
}

// ── 2. Offenes aus der Freigabe ──────────────────────────────────────
const offen = (status) => Object.entries(freigabe.abstimmungen).filter(([, e]) => e.status === status).map(([id]) => id);
const freigegeben = mitTelegram ? offen("freigegeben") : [];
const geaendert = mitTelegram ? offen("geaendert") : [];
if (mitTelegram) console.log(`${freigegeben.length} freigegeben, ${geaendert.length} geändert`);

// Abstimmung mit deutschem Titel und Änderungen aus Telegram.
const titelDe = new Map((await mitDeutschemTitel(abstimmungen.filter((a) =>
  kandidaten.some((k) => k.id === a.id) || [...freigegeben, ...geaendert].includes(String(a.id)),
))).map((a) => [String(a.id), a]));
const fertig = (id) => {
  const a = titelDe.get(String(id));
  return { ...mitAenderungen(a, freigabe.abstimmungen[id]?.aenderungen), originaltitel: nachId.get(String(id)).titel };
};

const vorschlagen = mitTelegram ? [...geaendert, ...kandidaten.map((k) => String(k.id))] : [];
const direkt = mitTelegram ? [] : kandidaten;
if (!vorschlagen.length && !freigegeben.length && !direkt.length) process.exit(0);

if (trocken) {
  console.log("Trockenlauf – es wird nichts verschickt.");
  for (const id of vorschlagen) console.log(`\n── Vorschau ${id}\n${vorschauText(fertig(id))}`);
  for (const id of freigegeben) console.log(`Würde einplanen: ${id} ${fertig(id).titel}`);
  const kanaele = ["x", "bluesky", "mastodon", "instagram", "facebook", "tiktok"].map((identifier) => ({ id: identifier, identifier }));
  for (const k of direkt) {
    const b = beitrag(fertig(k.id), { kanaele, bilder: { feed: [], hoch: [] }, datum: new Date().toISOString(), typ: k.typ });
    console.log(`\n── ${k.id} (${k.typ}) ${fertig(k.id).titel}`);
    for (const p of b.posts) console.log(`  ${p.integration.id}: ${p.value[0].content.replace(/<\/p><p>/g, "\n").replace(/<[^>]+>/g, "").length} Zeichen`);
  }
  process.exit(0);
}

const zuRendern = [...new Set([...vorschlagen, ...freigegeben, ...direkt.map((k) => String(k.id))])];
const grafiken = await grafikenRendern(zuRendern.map(fertig), personen);

// ── 3. Vorschauen nach Telegram ──────────────────────────────────────
if (vorschlagen.length) {
  const telegram = telegramClient({ token: TELEGRAM_BOT_TOKEN });
  for (const id of vorschlagen) {
    const a = fertig(id);
    const pngs = grafiken[id];
    // Feed-Karussell plus Übersicht im Hochformat (so sieht es auf TikTok/Story aus).
    const dateien = [...pngs.feed, pngs.hoch[0]];
    const bilder = await telegram.bilder(TELEGRAM_CHAT_ID, await Promise.all(dateien.map(async (p, i) => ({ daten: await readFile(p), name: `${id}-${i + 1}.png` }))));
    const warnung = a.piraten.status === "pruefen" ? `Bitte prüfen (${a.piraten.regel}): ${a.piraten.hinweis}` : null;
    const text = await telegram.nachricht(TELEGRAM_CHAT_ID, vorschauText(a, { warnung }), { reply_markup: knoepfe(id) });

    const vorher = freigabe.abstimmungen[id];
    freigabe.abstimmungen[id] = {
      status: "wartet",
      gesendet: vorher?.gesendet ?? new Date().toISOString(),
      nachrichten: [...(vorher?.nachrichten ?? []), ...bilder.map((b) => b.message_id), text.message_id],
      aenderungen: vorher?.aenderungen ?? {},
    };
    await speichern("data/freigabe.json", freigabe);
    console.log(`Vorschau gesendet: ${id} ${a.titel}`);
  }
}

// ── 4. An Postiz ─────────────────────────────────────────────────────
const anPostiz = [
  ...freigegeben.map((id) => ({ id, typ: "schedule" })),
  ...direkt.map((k) => ({ id: String(k.id), typ: k.typ })),
];
if (anPostiz.length) {
  if (!POSTIZ_URL || !POSTIZ_API_KEY) throw new Error("POSTIZ_URL und POSTIZ_API_KEY fehlen.");
  const verbindung = await postizVerbinden({ url: POSTIZ_URL, apiKey: POSTIZ_API_KEY });
  const telegram = mitTelegram ? telegramClient({ token: TELEGRAM_BOT_TOKEN }) : null;

  for (const { id, typ } of anPostiz) {
    const a = fertig(id);
    const pngs = grafiken[id];
    if (!passtInsLimit(verbindung, pngs, typ, o)) {
      console.log(`Anfragen-Limit erreicht (${verbindung.postiz.anfragen}/${o.max_anfragen_pro_lauf}) – Rest beim nächsten Lauf.`);
      break;
    }
    // Entwürfe einen Tag später (Postiz braucht ein Datum), Posts im Abstand von abstand_minuten.
    const datum = typ === "schedule"
      ? naechsterTermin(gepostet, { abstandMinuten: o.abstand_minuten })
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    gepostet[id] = await veroeffentlichen(verbindung, a, pngs, { datum, typ, o });
    // Nach jedem Post speichern, damit ein Abbruch nichts doppelt postet.
    await speichern("data/gepostet.json", gepostet);
    console.log(`${typ === "schedule" ? "Geplant" : "Entwurf"}: ${id} ${a.titel} (${datum})`);

    if (freigabe.abstimmungen[id]) {
      freigabe.abstimmungen[id].status = "gepostet";
      await speichern("data/freigabe.json", freigabe);
      const zeit = new Date(datum).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
      const kanaele = verbindung.kanaele.map((k) => k.name).join(", ");
      await telegram.nachricht(TELEGRAM_CHAT_ID, `📅 Eingeplant für ${zeit} auf ${kanaele}.`, {
        reply_parameters: { message_id: freigabe.abstimmungen[id].nachrichten.at(-1), allow_sending_without_reply: true },
      });
    }
  }
}
