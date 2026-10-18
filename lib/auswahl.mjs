// Welche Abstimmungen werden wann gepostet?
// Regeln wie bei check-some-votes.eu: neueste zuerst, Limits pro Tag und Woche (rollierend), alte Abstimmungen verfallen.

const TAG = 24 * 60 * 60 * 1000;

// hatTitel(a): nur Abstimmungen mit deutschem Titel werden gepostet, die übrigen kommen in `ohneTitel`.
// zaehlt(eintrag): welche Einträge von `gepostet` aufs Limit zählen (Standard: echte Posts, keine Entwürfe).
export function auswahl(abstimmungen, gepostet, { jetzt = new Date(), proTag = 3, proWoche = 12, maxAlterTage = 21, hatTitel = () => true, zaehlt = (g) => g.typ === "schedule" } = {}) {
  const zeit = jetzt.getTime();
  const veroeffentlicht = Object.values(gepostet).filter(zaehlt).map((g) => Date.parse(g.zeitpunkt));
  const letzterTag = veroeffentlicht.filter((t) => zeit - t < TAG).length;
  const letzteWoche = veroeffentlicht.filter((t) => zeit - t < 7 * TAG).length;
  const frei = Math.max(0, Math.min(proTag - letzterTag, proWoche - letzteWoche));

  const offen = abstimmungen
    .filter((a) => a.piraten.position && !gepostet[a.id])
    .filter((a) => zeit - Date.parse(a.zeitpunkt.replace(" ", "T") + "Z") <= maxAlterTage * TAG)
    .sort((a, b) => b.zeitpunkt.localeCompare(a.zeitpunkt) || b.id - a.id);
  const kandidaten = offen.filter(hatTitel);

  return {
    // Automatisch freigegebene Abstimmungen werden eingeplant, bis das Limit erreicht ist.
    posten: kandidaten.filter((a) => a.piraten.status === "automatisch").slice(0, frei),
    // Abstimmungen „pruefen“ landen als Entwurf in Postiz – dort entscheidet ein Mensch.
    entwuerfe: kandidaten.filter((a) => a.piraten.status === "pruefen"),
    // Ohne deutschen Titel wird nichts gepostet – Titel in titel.json eintragen.
    ohneTitel: offen.filter((a) => !hatTitel(a)),
    // Für die Freigabe über Telegram: alle Kandidaten (neueste zuerst) und wie viele noch ins Limit passen.
    kandidaten,
    frei,
  };
}
