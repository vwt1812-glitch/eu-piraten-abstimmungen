// Auf welchen Postiz-Kanälen gepostet wird. In Postiz können viel mehr Accounts verbunden sein –
// gepostet wird nur auf ausdrücklich ausgewählten (Zugangsdaten auf dem Pi, nicht im öffentlichen Repo):
//   POSTIZ_KANAELE  kommagetrennt: Name, Profil/Handle oder Postiz-ID je Kanal
//   POSTIZ_KUNDE    Name oder ID eines Postiz-„Kunden“ – alle seine Kanäle
import { unterstuetzt } from "./beitrag.mjs";

const norm = (text) => String(text ?? "").trim().toLowerCase().replace(/^@/, "");

export function auswahlAusUmgebung(env) {
  return {
    kanaele: (env.POSTIZ_KANAELE ?? "").split(",").map((k) => k.trim()).filter(Boolean),
    kunde: env.POSTIZ_KUNDE?.trim() || null,
  };
}

function passtZu(kanal, eintrag) {
  const e = norm(eintrag);
  return [kanal.id, kanal.name, kanal.profile].some((wert) => wert && norm(wert) === e);
}

function vomKunden(kanal, kunde) {
  return Boolean(kunde && kanal.customer && [kanal.customer.id, kanal.customer.name].some((w) => norm(w) === norm(kunde)));
}

// alle: Antwort von GET /integrations. Gibt ausgewählte (postbare) Kanäle und Hinweise zurück.
export function kanaeleAuswaehlen(alle, { kanaele = [], kunde = null } = {}) {
  if (!kanaele.length && !kunde) {
    return { ausgewaehlt: [], fehler: "Keine Kanäle ausgewählt – POSTIZ_KANAELE oder POSTIZ_KUNDE in /etc/eu-piraten.env eintragen (Übersicht: /kanaele)." };
  }
  const gewaehlt = alle.filter((k) => kanaele.some((e) => passtZu(k, e)) || vomKunden(k, kunde));
  const nichtGefunden = kanaele.filter((e) => !alle.some((k) => passtZu(k, e)));
  if (kunde && !alle.some((k) => vomKunden(k, kunde))) nichtGefunden.push(`Kunde „${kunde}“`);
  return {
    ausgewaehlt: gewaehlt.filter(unterstuetzt),
    nichtUnterstuetzt: gewaehlt.filter((k) => !unterstuetzt(k)),
    nichtGefunden,
  };
}

// Text für /kanaele in Telegram.
// mastodon: null (nicht direkt angebunden) oder { konto, einstellungen } bzw. { fehler }.
export function kanalUebersicht(alle, auswahl, mastodon = null) {
  const { ausgewaehlt, nichtUnterstuetzt = [], nichtGefunden = [], fehler } = kanaeleAuswaehlen(alle, auswahl);
  const direkt = (k) => mastodon && /^mastodon/.test(k.identifier);
  const an = new Set(ausgewaehlt.filter((k) => !direkt(k)).map((k) => k.id));
  // Was der Dienst tatsächlich geladen hat – wer /etc/eu-piraten.env ändert, muss neu starten.
  const geladen = [
    `POSTIZ_KUNDE: ${auswahl.kunde ? `„${auswahl.kunde}“` : "(leer)"}`,
    `POSTIZ_KANAELE: ${auswahl.kanaele?.length ? auswahl.kanaele.map((k) => `„${k}“`).join(", ") : "(leer)"}`,
  ];
  const zeilen = ["Geladene Auswahl:", ...geladen, "", "Kanäle in Postiz (✅ = hier wird gepostet):", ""];
  for (const k of alle) {
    const zeichen = an.has(k.id) ? "✅" : "⬜";
    const details = [k.identifier, k.profile && `@${norm(k.profile)}`, k.customer?.name && `Kunde: ${k.customer.name}`, k.disabled && "deaktiviert"]
      .filter(Boolean).join(", ");
    zeilen.push(`${zeichen} ${k.name} (${details})${direkt(k) && ausgewaehlt.includes(k) ? " – übersprungen, Mastodon läuft direkt" : ""}`, `    ID: ${k.id}`);
  }
  if (mastodon?.konto) {
    const e = mastodon.einstellungen ?? {};
    zeilen.push("", `✅ Mastodon direkt: @${mastodon.konto} (${e.sichtbarkeit ?? "unlisted"}${e.inhaltswarnung ? `, Inhaltswarnung „${e.inhaltswarnung}“` : ", ohne Inhaltswarnung"})`);
  } else if (mastodon?.fehler) zeilen.push("", `⚠️ Mastodon direkt nicht erreichbar: ${mastodon.fehler}`);
  if (fehler && !mastodon?.konto) zeilen.push("", `⚠️ ${fehler}`);
  for (const k of nichtUnterstuetzt) zeilen.push("", `⚠️ ${k.name}: ausgewählt, aber ${k.disabled ? "in Postiz deaktiviert" : `Typ „${k.identifier}“ wird nicht unterstützt`}.`);
  for (const e of nichtGefunden) zeilen.push("", `⚠️ „${e}“ aus der Auswahl gibt es in Postiz nicht.`);
  zeilen.push("", "Auswahl ändern: POSTIZ_KANAELE (Namen oder IDs, kommagetrennt) bzw. POSTIZ_KUNDE in /etc/eu-piraten.env, dann sudo systemctl restart eu-piraten.");
  return zeilen.join("\n");
}
