import { test } from "node:test";
import assert from "node:assert/strict";
import { uebersichtHtml, abgeordneteFolien, nachname, slug, GESICHTER_PRO_FOLIE } from "../lib/grafik.mjs";

function abstimmung(parteien) {
  const abgeordnete = [];
  let id = 1;
  for (const [partei, n] of parteien) for (let i = 0; i < n; i++) abgeordnete.push([id++, partei, "FOR"]);
  return {
    id: 1,
    zeitpunkt: "2026-10-08 12:00:00",
    titel: "Test",
    ergebnis: "ADOPTED",
    stimmen: { FOR: 1, AGAINST: 2, ABSTENTION: 3, DID_NOT_VOTE: 4 },
    deutschland: parteien.map(([partei, n]) => ({ partei, FOR: n, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0, mehrheit: "FOR" })),
    abgeordnete,
    piraten: { position: "AGAINST", quelle: "regel", hinweis: "Wir <3 Tests" },
  };
}

test("Nachnamen aus Großbuchstaben", () => {
  assert.equal(nachname("MCALLISTER"), "McAllister");
  assert.equal(nachname("VON DER SCHULENBURG"), "Von der Schulenburg");
  assert.equal(nachname("STRACK-ZIMMERMANN"), "Strack-Zimmermann");
  assert.equal(nachname("BOßDORF"), "Boßdorf");
});

test("Dateinamen für Logos", () => {
  assert.equal(slug("Freie Wähler"), "freie-waehler");
  assert.equal(slug("Die PARTEI"), "die-partei");
  assert.equal(slug("ÖDP"), "oedp");
});

test("Übersicht: Piraten-Position, Abweichung und escapter Hinweis", () => {
  const html = uebersichtHtml(abstimmung([["CDU", 3]]), { titel: "A & B", css: "" });
  assert.match(html, /A &amp; B/);
  assert.match(html, /Dagegen\*/);
  assert.match(html, /Wir &lt;3 Tests/);
});

test("Abgeordnete: Parteien werden auf möglichst wenige Folien verteilt, nie geteilt", () => {
  const a = abstimmung([["CDU", 23], ["AfD", 15], ["SPD", 14], ["Grüne", 12], ["CSU", 6], ["FDP", 5], ["BSW", 4], ["Volt", 3]]);
  const folien = abgeordneteFolien(a, { titel: "T", personen: {}, css: "" });
  assert.equal(folien.length, 2);
  // Piraten nur auf der ersten Folie
  assert.match(folien[0], /gruppe-piraten/);
  assert.doesNotMatch(folien[1], /gruppe-piraten/);
  for (const html of folien) {
    assert.ok((html.match(/<figure>/g) ?? []).length <= GESICHTER_PRO_FOLIE);
  }
  const gesamt = folien.join("").match(/<figure>/g).length;
  assert.equal(gesamt, a.abgeordnete.length + 1);
});
