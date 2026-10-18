// Mastodon direkt über die API statt über Postiz: Postiz postet dort immer „öffentlich“ und ohne Inhaltswarnung
// (mastodon.provider.ts: visibility 'public'). Viele Instanzen verlangen für automatisierte Accounts aber
// „ungelistet“ (nicht auf der lokalen Timeline) und Inhaltswarnungen bei politischen Themen.
//   MASTODON_URL    Adresse der Instanz, z. B. https://mastodon.example
//   MASTODON_TOKEN  Zugriffstoken: Einstellungen → Entwicklung → Neue Anwendung
//                   (Berechtigungen read:accounts, write:media, write:statuses)
import { posttextLang } from "./posttext.mjs";

const LIMIT = 500;

// Wie Mastodon zählt: Codepoints (ein Emoji meist 1–2), jeder Link pauschal 23 Zeichen.
export function mastodonLaenge(text) {
  return [...text.replace(/https?:\/\/\S+/g, "x".repeat(23))].length;
}

export function mastodonAusUmgebung(env) {
  const url = env.MASTODON_URL?.trim().replace(/\/+$/, "");
  const token = env.MASTODON_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

export function mastodonClient({ url, token, fetch = globalThis.fetch }) {
  async function anfrage(pfad, optionen = {}) {
    const res = await fetch(url + pfad, {
      ...optionen,
      headers: { Authorization: `Bearer ${token}`, ...optionen.headers },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Mastodon ${optionen.method ?? "GET"} ${pfad}: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }

  return {
    konto: () => anfrage("/api/v1/accounts/verify_credentials"),

    // Bild mit Alternativtext hochladen; gibt die Medien-ID zurück.
    async hochladen(daten, dateiname, alt, typ = "image/png") {
      const form = new FormData();
      form.append("file", new Blob([daten], { type: typ }), dateiname);
      if (alt) form.append("description", alt.slice(0, 1500));
      return (await anfrage("/api/v2/media", { method: "POST", body: form })).id;
    },

    // Mit scheduled_at plant Mastodon den Post selbst ein. Idempotency-Key verhindert Doppelposts bei Wiederholung.
    statusAnlegen: (body, schluessel) =>
      anfrage("/api/v1/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(schluessel ? { "Idempotency-Key": schluessel } : {}) },
        body: JSON.stringify(body),
      }),
  };
}

// Inhaltswarnung aus der Vorlage (config.json → mastodon.inhaltswarnung), {titel} wird ersetzt und ggf. gekürzt.
export function inhaltswarnung(abstimmung, vorlage = "EU-Politik: {titel}", max = 100) {
  if (!vorlage) return "";
  const zeichen = [...abstimmung.titel];
  let text = vorlage.replace("{titel}", abstimmung.titel);
  for (let n = zeichen.length; mastodonLaenge(text) > max && n > 0; n--) {
    text = vorlage.replace("{titel}", zeichen.slice(0, n - 1).join("").trimEnd() + "…");
  }
  return text;
}

// Body für POST /api/v1/statuses. Die Inhaltswarnung zählt bei Mastodon zur Zeichengrenze.
export function mastodonStatus(abstimmung, { mediaIds, datum, einstellungen = {} }) {
  const cw = inhaltswarnung(abstimmung, einstellungen.inhaltswarnung);
  const body = {
    status: posttextLang(abstimmung, LIMIT - mastodonLaenge(cw), mastodonLaenge),
    media_ids: mediaIds,
    visibility: einstellungen.sichtbarkeit ?? "unlisted",
    language: "de",
  };
  if (cw) body.spoiler_text = cw;
  // Mastodon verlangt für geplante Posts mindestens 5 Minuten Vorlauf; früher → sofort posten.
  if (datum && Date.parse(datum) - Date.now() > 5 * 60 * 1000) body.scheduled_at = new Date(datum).toISOString();
  return body;
}

// Lädt die Feed-Grafiken hoch und legt den (geplanten) Post an. Gibt { id, geplant } zurück.
export async function mastodonPosten(client, abstimmung, bilder, { datum, einstellungen }) {
  const mediaIds = [];
  for (const [i, b] of bilder.slice(0, 4).entries()) {
    mediaIds.push(await client.hochladen(b.daten, `${abstimmung.id}-${i + 1}.png`, b.alt));
  }
  const body = mastodonStatus(abstimmung, { mediaIds, datum, einstellungen });
  const antwort = await client.statusAnlegen(body, `eu-piraten-${abstimmung.id}`);
  return { id: antwort.id, geplant: Boolean(body.scheduled_at) };
}

// Postiz-Kanäle für Mastodon überspringen, wenn Mastodon direkt angebunden ist – sonst käme alles doppelt und öffentlich.
export function ohnePostizMastodon(kanaele) {
  return kanaele.filter((k) => !/^mastodon/.test(k.identifier));
}
