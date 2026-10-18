// Hinweise, bei denen jemand etwas anpassen muss – der Bot schickt sie nach dem täglichen Lauf in Telegram.
import { BEKANNTE_PARTEIEN } from "./parteien.mjs";

const TAG = 24 * 60 * 60 * 1000;

// Parteien ohne Anzeigenamen in lib/parteien.mjs (z. B. nach einem Wechsel zu einer neuen Partei),
// nur aus Abstimmungen der letzten `tage` Tage. Gibt [{ partei, seit, abgeordnete: [ids] }] zurück.
export function unbekannteParteien(abstimmungen, { tage = 60, jetzt = new Date() } = {}) {
  const funde = new Map();
  for (const a of abstimmungen) {
    if (jetzt.getTime() - Date.parse(a.zeitpunkt.replace(" ", "T") + "Z") > tage * TAG) continue;
    for (const [id, partei] of a.abgeordnete) {
      if (BEKANNTE_PARTEIEN.has(partei)) continue;
      if (!funde.has(partei)) funde.set(partei, { partei, seit: a.zeitpunkt.slice(0, 10), abgeordnete: new Set() });
      const f = funde.get(partei);
      f.abgeordnete.add(id);
      if (a.zeitpunkt.slice(0, 10) < f.seit) f.seit = a.zeitpunkt.slice(0, 10);
    }
  }
  return [...funde.values()].map((f) => ({ ...f, abgeordnete: [...f.abgeordnete] }));
}

// Hat die Referenz-Abgeordnete an den letzten `sitzungstage` Abstimmungstagen nie abgestimmt?
// referenzStimme null = sie steht gar nicht mehr in den Daten (vermutlich ausgeschieden).
// Gibt null zurück, wenn alles in Ordnung ist.
export function referenzAbwesend(abstimmungen, { sitzungstage = 4 } = {}) {
  const tage = [...new Set(abstimmungen.map((a) => a.zeitpunkt.slice(0, 10)))].sort().reverse();
  if (tage.length < sitzungstage) return null;
  const letzte = new Set(tage.slice(0, sitzungstage));
  const neueste = abstimmungen.filter((a) => letzte.has(a.zeitpunkt.slice(0, 10)));
  const abgestimmt = (a) => a.referenzStimme && a.referenzStimme !== "DID_NOT_VOTE";
  if (neueste.some(abgestimmt)) return null;

  const zuletzt = abstimmungen.filter(abgestimmt).map((a) => a.zeitpunkt.slice(0, 10)).sort().at(-1) ?? null;
  return {
    tage: [...letzte].sort(),
    zuletztAbgestimmt: zuletzt,
    nichtMehrInDaten: neueste.every((a) => a.referenzStimme === null),
  };
}

// Texte für Telegram. gewarnt: { [schluessel]: true } – damit jede Warnung nur einmal kommt.
export function warnungenTexte(abstimmungen, { personen, referenzName, gewarnt, sitzungstage, jetzt }) {
  const texte = [];
  const neu = {};

  for (const f of unbekannteParteien(abstimmungen, { jetzt })) {
    const schluessel = `partei:${f.partei}`;
    if (gewarnt[schluessel]) continue;
    neu[schluessel] = true;
    const namen = f.abgeordnete.map((id) => personen[id] ? `${personen[id].vorname} ${personen[id].nachname}` : `ID ${id}`).join(", ");
    texte.push([
      `⚠️ Unbekannte Partei „${f.partei}“ (seit ${f.seit}): ${namen}`,
      "Auf den Grafiken erscheint sie bisher grau mit diesem Kürzel. Bitte Anzeigenamen (lib/parteien.mjs), " +
        "Farbe (lib/grafik.mjs) und Logo (assets/logos/) ergänzen.",
    ].join("\n"));
  }

  const r = referenzAbwesend(abstimmungen, { sitzungstage });
  if (r) {
    const schluessel = `referenz:${r.tage.at(-1)}`;
    if (!gewarnt[schluessel]) {
      neu[schluessel] = true;
      texte.push([
        `⚠️ ${referenzName} hat an den letzten ${r.tage.length} Abstimmungstagen (${r.tage[0]} bis ${r.tage.at(-1)}) nicht abgestimmt` +
          (r.zuletztAbgestimmt ? ` – zuletzt am ${r.zuletztAbgestimmt}.` : "."),
        r.nichtMehrInDaten
          ? "Sie steht gar nicht mehr in den Abstimmungsdaten – vermutlich ist sie aus dem Parlament ausgeschieden."
          : "Vielleicht nur abwesend (Krankheit, Elternzeit …).",
        "Solange gibt es keine Vorschläge. Ist sie ausgeschieden: in config.json unter „referenz“ eine andere Abgeordnete eintragen.",
      ].join("\n"));
    }
  }
  return { texte, neu };
}
