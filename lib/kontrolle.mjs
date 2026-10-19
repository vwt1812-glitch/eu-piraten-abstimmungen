// Kontrolle nach dem Einplanen: Hat Postiz unsere Posts zum Termin wirklich veröffentlicht?
// Postiz veröffentlicht über Temporal; hängt dort etwas (z. B. der Orchestrator nach einem Neustart),
// bleiben Posts still auf „QUEUE“ stehen. Der Bot fragt deshalb nach (GET /posts) und meldet sich in Telegram.
// Zustand in daten/kontrolle.json: { erledigt: { postId: true }, gemeldet: { postId: "QUEUE" | "ERROR" } }

export const KARENZ_MINUTEN = 15;
const MAX_TAGE = 3;

// Alle Postiz-Post-IDs aus daten/gepostet.json mit Termin: Map postId → { abstimmung, zeitpunkt }
export function erwartetePosts(gepostet) {
  const ids = new Map();
  for (const [abstimmung, g] of Object.entries(gepostet)) {
    if (g.typ !== "schedule") continue;
    for (const p of [...(g.postiz ?? []), ...(g.story ?? [])]) {
      if (p?.postId) ids.set(p.postId, { abstimmung, zeitpunkt: g.zeitpunkt });
    }
  }
  return ids;
}

// Posts, deren Termin plus Karenz vorbei ist (höchstens MAX_TAGE alt) und die noch nicht als erledigt gelten.
export function faelligeKontrollen(erwartet, kontrolle, jetzt = new Date(), karenz = KARENZ_MINUTEN) {
  const bis = jetzt.getTime() - karenz * 60 * 1000;
  const ab = jetzt.getTime() - MAX_TAGE * 864e5;
  return [...erwartet].filter(([id, e]) => {
    const t = Date.parse(e.zeitpunkt);
    return !kontrolle.erledigt?.[id] && t <= bis && t >= ab;
  });
}

// Zeitraum für GET /posts: vom ältesten fälligen Termin bis morgen (falls jemand in Postiz verschoben hat).
export function abfragezeitraum(faellig, jetzt = new Date()) {
  const aeltester = Math.min(...faellig.map(([, e]) => Date.parse(e.zeitpunkt)));
  return {
    startDate: new Date(aeltester - 864e5).toISOString(),
    endDate: new Date(jetzt.getTime() + 864e5).toISOString(),
  };
}

const KANAL = { x: "X", bluesky: "Bluesky", mastodon: "Mastodon", threads: "Threads", facebook: "Facebook", instagram: "Instagram", "instagram-standalone": "Instagram", tiktok: "TikTok", "tiktok-business": "TikTok", telegram: "Telegram" };
const uhrzeit = (d) => new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit" });
const kurz = (html) => String(html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);

// posts: Antwort von GET /posts (.posts). Ändert `kontrolle` und gibt die Telegram-Texte zurück.
export function auswerten(posts, faellig, kontrolle, jetzt = new Date(), karenz = KARENZ_MINUTEN) {
  kontrolle.erledigt ??= {};
  kontrolle.gemeldet ??= {};
  const nachId = new Map(posts.map((p) => [p.id, p]));
  const probleme = [];
  const nachgeholt = [];

  for (const [id] of faellig) {
    const p = nachId.get(id);
    const name = p ? `${KANAL[p.integration?.providerIdentifier] ?? p.integration?.providerIdentifier} (${p.integration?.name})` : "";
    if (!p) {
      // In Postiz gelöscht oder weit verschoben – nichts mehr zu kontrollieren.
      kontrolle.erledigt[id] = true;
      delete kontrolle.gemeldet[id];
    } else if (p.state === "PUBLISHED") {
      kontrolle.erledigt[id] = true;
      if (kontrolle.gemeldet[id]) nachgeholt.push(`• ${name}: ${kurz(p.content)}`);
      delete kontrolle.gemeldet[id];
    } else if (p.state === "ERROR" && kontrolle.gemeldet[id] !== "ERROR") {
      kontrolle.gemeldet[id] = "ERROR";
      probleme.push({ fehler: true, text: `• ${name}, geplant ${uhrzeit(p.publishDate)}: Fehler – ${p.error ?? "ohne Meldung"}\n  ${kurz(p.content)}` });
    } else if (p.state === "QUEUE" && !kontrolle.gemeldet[id] && jetzt - new Date(p.publishDate) > karenz * 60 * 1000) {
      kontrolle.gemeldet[id] = "QUEUE";
      const minuten = Math.round((jetzt - new Date(p.publishDate)) / 60000);
      probleme.push({ fehler: false, text: `• ${name}, geplant ${uhrzeit(p.publishDate)}: wartet seit ${minuten} Minuten\n  ${kurz(p.content)}` });
    }
  }

  const texte = [];
  if (probleme.length) {
    const nurWartend = probleme.every((p) => !p.fehler);
    texte.push([
      `⚠️ Postiz hat ${probleme.length === 1 ? "einen Post" : `${probleme.length} Posts`} nicht veröffentlicht:`,
      ...probleme.map((p) => p.text),
      "",
      nurWartend
        ? "Hängen sie alle, läuft vermutlich der Orchestrator von Postiz nicht (z. B. nach einem Neustart).\nPrüfen: docker exec postiz pm2 list – im Zweifel: docker restart postiz"
        : "Den Fehler zeigt Postiz auch am Post im Kalender; oft muss der Kanal neu verbunden werden.",
    ].join("\n"));
  }
  if (nachgeholt.length) texte.push([`✅ Inzwischen veröffentlicht:`, ...nachgeholt].join("\n"));
  return texte;
}
