// Wertet die Hauptabstimmungen seit config.seit aus und schreibt daten/abstimmungen.json.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { leseCsv, leseAlle } from "../lib/csv.mjs";
import { abstimmungAuswerten } from "../lib/auswertung.mjs";

// Wie make: nur neu auswerten, wenn Daten, Regeln oder Konfiguration neuer sind als das Ergebnis (--immer erzwingt).
async function aktuell(ergebnis, quellen) {
  const zeit = async (p) => (await stat(p).catch(() => null))?.mtimeMs ?? null;
  const ziel = await zeit(ergebnis);
  if (ziel === null) return false;
  for (const q of quellen) if ((await zeit(q)) > ziel) return false;
  return true;
}

const pfad = (p) => fileURLToPath(new URL("../" + p, import.meta.url));
if (!process.argv.includes("--immer") &&
    await aktuell(pfad("daten/abstimmungen.json"), ["cache/last_updated.txt", "abweichungen.json", "config.json"].map(pfad))) {
  console.log("Auswertung ist aktuell.");
  process.exit(0);
}
await mkdir(pfad("daten"), { recursive: true });

const config = JSON.parse(await readFile(pfad("config.json")));
const regeln = JSON.parse(await readFile(pfad("abweichungen.json")));
const cache = (name) => pfad(`cache/${name}.csv.gz`);

// Nur Hauptabstimmungen (Schlussabstimmungen, Gesamttext), keine Änderungsanträge.
const votes = await leseAlle(cache("votes"), (v) => v.is_main === "True" && v.timestamp >= config.seit);
const abstimmungen = new Map(
  votes.map((v) => [Number(v.id), {
    id: Number(v.id),
    zeitpunkt: v.timestamp,
    titel: v.display_title,
    referenz: v.reference || null,
    beschreibung: v.description || null,
    ergebnis: v.result || null,
    stimmen: {
      FOR: Number(v.count_for),
      AGAINST: Number(v.count_against),
      ABSTENTION: Number(v.count_abstention),
      DID_NOT_VOTE: Number(v.count_did_not_vote),
    },
    verfahren: v.procedure_reference
      ? { referenz: v.procedure_reference, titel: v.procedure_title, art: v.procedure_type }
      : null,
    sachgebiete: [],
    eurovoc: [],
  }]),
);
console.log(`${abstimmungen.size} Hauptabstimmungen seit ${config.seit}`);

async function zuordnen(verknuepfung, spalte, begriffe, idSpalte, feld) {
  const namen = new Map((await leseAlle(cache(begriffe))).map((b) => [b[idSpalte], b.label]));
  for await (const row of leseCsv(cache(verknuepfung))) {
    const a = abstimmungen.get(Number(row.vote_id));
    const name = namen.get(row[spalte]);
    if (a && name) a[feld].push(name);
  }
}
await zuordnen("oeil_subject_votes", "oeil_subject_code", "oeil_subjects", "code", "sachgebiete");
await zuordnen("eurovoc_concept_votes", "eurovoc_concept_id", "eurovoc_concepts", "id", "eurovoc");

// member_votes ist groß (> 1 GB entpackt) – einmal durchstreamen.
const deutsche = new Map();
const referenz = new Map();
const referenzId = String(config.referenz.id);
for await (const s of leseCsv(cache("member_votes"))) {
  const id = Number(s.vote_id);
  if (!abstimmungen.has(id)) continue;
  if (s.member_id === referenzId) referenz.set(id, s.position);
  if (s.country_code === config.land) {
    if (!deutsche.has(id)) deutsche.set(id, []);
    deutsche.get(id).push({ id: Number(s.member_id), partei: s.national_party_short_label, position: s.position });
  }
}

const ergebnis = [...abstimmungen.values()]
  .map((abstimmung) => abstimmungAuswerten({
    abstimmung,
    deutsche: deutsche.get(abstimmung.id) ?? [],
    referenzPosition: referenz.get(abstimmung.id),
    regeln,
  }))
  .sort((a, b) => b.zeitpunkt.localeCompare(a.zeitpunkt) || b.id - a.id);

// Namen der deutschen Abgeordneten und der Referenz-Abgeordneten für die Grafiken.
const ids = new Set([config.referenz.id]);
for (const liste of deutsche.values()) for (const s of liste) ids.add(s.id);
const abgeordnete = {};
for await (const m of leseCsv(cache("members"))) {
  if (ids.has(Number(m.id))) abgeordnete[m.id] = { vorname: m.first_name, nachname: m.last_name };
}
await writeFile(pfad("daten/abgeordnete.json"), JSON.stringify(abgeordnete, null, 1) + "\n");

const stand = (await readFile(pfad("cache/last_updated.txt"), "utf8").catch(() => "")).trim() || null;
// Eine Zeile pro Abstimmung: kompakt, aber mit lesbaren Diffs.
const zeilen = ergebnis.map((a) => " " + JSON.stringify(a)).join(",\n");
await writeFile(pfad("daten/abstimmungen.json"), `{"stand":${JSON.stringify(stand)},"abstimmungen":[\n${zeilen}\n]}\n`);

const status = Object.groupBy(ergebnis, (a) => a.piraten.status);
for (const [k, v] of Object.entries(status)) console.log(`${k}: ${v.length}`);
