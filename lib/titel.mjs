// Deutsche Titel von check-some-votes.eu (offizielle Titel des Europaparlaments).
//
// GET /api/votes?lang=de&start_date=&end_date=&page=&page_size=100 liefert Hauptabstimmungen mit
// id, title, reference (z. B. „A10-0197/2026“), date und Stimmenzahlen. Fehlt ein deutscher Titel,
// liefert die API den englischen – deshalb wird zusätzlich lang=en abgefragt und verglichen.
// Quelle: csv_check_votes/routers/vote_list.py in gitlab.com/parteidesfortschritts/csv.check_some_votes

const TOLERANZ_MIT_REFERENZ = 10; // Stimmen dürfen sich durch Korrekturen leicht unterscheiden
const TOLERANZ_OHNE_REFERENZ = 3;

function referenz(text) {
  return (text ?? "").replace(/\s+/g, "").toUpperCase() || null;
}

function abstand(a, v) {
  return Math.abs(a.stimmen.FOR - v.for_count) + Math.abs(a.stimmen.AGAINST - v.against_count) + Math.abs(a.stimmen.ABSTENTION - v.abstention_count);
}

// Ordnet unseren Abstimmungen (HowTheyVote) die Einträge von check-some-votes zu.
// deutsch/englisch: Listen aus /api/votes mit lang=de bzw. lang=en. Gibt { [id]: deutscherTitel } zurück.
export function titelZuordnen(abstimmungen, deutsch, englisch) {
  const englischeTitel = new Map(englisch.map((v) => [v.id, v.title]));
  const proTag = new Map();
  for (const v of deutsch) {
    const tag = (v.date ?? "").slice(0, 10);
    if (!proTag.has(tag)) proTag.set(tag, []);
    proTag.get(tag).push(v);
  }

  const ergebnis = {};
  const vergeben = new Set();
  for (const a of abstimmungen) {
    let kandidaten = proTag.get(a.zeitpunkt.slice(0, 10)) ?? [];
    const ref = referenz(a.referenz);
    const mitReferenz = ref ? kandidaten.filter((v) => referenz(v.reference) === ref) : [];
    const toleranz = mitReferenz.length ? TOLERANZ_MIT_REFERENZ : TOLERANZ_OHNE_REFERENZ;
    if (mitReferenz.length) kandidaten = mitReferenz;

    const sortiert = kandidaten
      .filter((v) => !vergeben.has(v.id))
      .map((v) => ({ v, d: abstand(a, v) }))
      .filter(({ d }) => d <= toleranz)
      .sort((x, y) => x.d - y.d);
    // Bei Gleichstand ohne Referenz ist die Zuordnung nicht eindeutig – dann lieber keinen Titel.
    if (!sortiert.length || (!mitReferenz.length && sortiert[1]?.d === sortiert[0].d)) continue;

    const { v } = sortiert[0];
    const titel = v.title?.trim();
    if (!titel || titel === englischeTitel.get(v.id)?.trim()) continue; // nur englisch vorhanden
    vergeben.add(v.id);
    ergebnis[a.id] = titel;
  }
  return ergebnis;
}

export async function abstimmungenLaden({ basis, lang, von, bis, fetch = globalThis.fetch }) {
  const votes = [];
  for (let page = 1; ; page++) {
    const url = `${basis.replace(/\/+$/, "")}/api/votes?lang=${lang}&start_date=${von}&end_date=${bis}&page=${page}&page_size=100`;
    let res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429) {
      // Die API begrenzt Anfragen; einmal warten und wiederholen.
      await new Promise((r) => setTimeout(r, Math.min(60, Number(res.headers.get("retry-after")) || 10) * 1000));
      res = await fetch(url, { headers: { Accept: "application/json" } });
    }
    if (!res.ok) throw new Error(`check-some-votes ${url}: HTTP ${res.status}`);
    const seite = await res.json();
    votes.push(...seite.votes);
    if (page >= seite.total_pages) return votes;
  }
}
