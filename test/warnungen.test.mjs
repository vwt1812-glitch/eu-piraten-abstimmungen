import { test } from "node:test";
import assert from "node:assert/strict";
import { unbekannteParteien, referenzAbwesend, warnungenTexte } from "../lib/warnungen.mjs";
import { BEKANNTE_PARTEIEN } from "../lib/parteien.mjs";
import { FARBEN } from "../lib/grafik.mjs";

const JETZT = new Date("2026-10-18T12:00:00Z");
function abstimmung(tag, referenzStimme, abgeordnete = [[1, "CDU", "FOR"]]) {
  return { zeitpunkt: `${tag} 12:00:00`, referenzStimme, abgeordnete };
}

test("Jede bekannte Partei hat eine Farbe für die Grafik", () => {
  for (const p of BEKANNTE_PARTEIEN) assert.ok(FARBEN[p], `Farbe fehlt für ${p}`);
});

test("Unbekannte Partei wird gefunden, alte Abstimmungen zählen nicht", () => {
  const liste = [
    abstimmung("2026-10-08", "FOR", [[1, "CDU", "FOR"], [2, "Neue Partei", "AGAINST"]]),
    abstimmung("2026-10-07", "FOR", [[2, "Neue Partei", "FOR"], [3, "Neue Partei", "FOR"]]),
    abstimmung("2025-01-01", "FOR", [[4, "Uralt", "FOR"]]),
  ];
  assert.deepEqual(unbekannteParteien(liste, { jetzt: JETZT }), [{ partei: "Neue Partei", seit: "2026-10-07", abgeordnete: [2, 3] }]);
});

test("Referenz: Warnung erst, wenn sie an allen letzten Abstimmungstagen fehlt", () => {
  const tage = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"];
  assert.equal(referenzAbwesend([abstimmung("2026-09-17", "FOR"), ...tage.map((t) => abstimmung(t, "DID_NOT_VOTE")).slice(0, 3), abstimmung(tage[3], "AGAINST")]), null);

  const abwesend = referenzAbwesend([abstimmung("2026-09-17", "FOR"), ...tage.map((t) => abstimmung(t, "DID_NOT_VOTE"))]);
  assert.deepEqual(abwesend, { tage, zuletztAbgestimmt: "2026-09-17", nichtMehrInDaten: false });

  const weg = referenzAbwesend([abstimmung("2026-09-17", "FOR"), ...tage.map((t) => abstimmung(t, null))]);
  assert.equal(weg.nichtMehrInDaten, true);
  assert.equal(referenzAbwesend([abstimmung("2026-10-08", null)]), null); // zu wenig Tage
});

test("Warnungstexte kommen nur einmal", () => {
  const liste = [
    ...["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08"].map((t) => abstimmung(t, null, [[2, "Neue Partei", "FOR"]])),
  ];
  const optionen = { personen: { 2: { vorname: "Erika", nachname: "MUSTER" } }, referenzName: "Markéta Gregorová", gewarnt: {}, jetzt: JETZT };
  const erst = warnungenTexte(liste, optionen);
  assert.equal(erst.texte.length, 2);
  assert.match(erst.texte[0], /Unbekannte Partei „Neue Partei“ \(seit 2026-10-05\): Erika MUSTER/);
  assert.match(erst.texte[1], /nicht abgestimmt\.\nSie steht gar nicht mehr in den Abstimmungsdaten/);
  assert.deepEqual(Object.keys(erst.neu), ["partei:Neue Partei", "referenz:2026-10-08"]);

  assert.equal(warnungenTexte(liste, { ...optionen, gewarnt: erst.neu }).texte.length, 0);
});
