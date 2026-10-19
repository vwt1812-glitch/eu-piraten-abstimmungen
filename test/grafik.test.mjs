import { test } from "node:test";
import assert from "node:assert/strict";
import { uebersichtHtml, abgeordneteFolien, nachname, slug, titelKuerzen, FORMATE, GESICHTER_PRO_FOLIE, verteilung, verteilungText, verteilungWorte, nachLager, erklaerungPunkte } from "../lib/grafik.mjs";

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
    assert.ok((html.match(/<figure[ >]/g) ?? []).length <= GESICHTER_PRO_FOLIE);
  }
  const gesamt = folien.join("").match(/<figure[ >]/g).length;
  assert.equal(gesamt, a.abgeordnete.length + 1);
});

test("Hochformat: Seitengröße und Format-Klasse", () => {
  const html = uebersichtHtml(abstimmung([["CDU", 3]]), { titel: "T", css: "", format: FORMATE.hoch });
  assert.match(html, /width:1080px;height:1920px/);
  assert.match(html, /class="karte format-hoch"/);
  const feed = abgeordneteFolien(abstimmung([["CDU", 3]]), { titel: "T", personen: {}, css: "" })[0];
  const hoch = abgeordneteFolien(abstimmung([["CDU", 3]]), { titel: "T", personen: {}, css: "", format: FORMATE.hoch })[0];
  const groesse = (h) => Number(h.match(/--gesicht:(\d+)px/)[1]);
  assert.ok(groesse(hoch) > groesse(feed));
});

test("Sehr lange Titel werden am Wortende gekürzt", () => {
  const lang = "Wort ".repeat(60).trim();
  const k = titelKuerzen(lang);
  assert.ok(k.length <= 202);
  assert.match(k, /Wort …$/);
  assert.equal(titelKuerzen("kurz"), "kurz");
});

test("Verteilungsbalken: nur vorhandene Stimmen, proportional, Zahlen nur bei genug Platz", () => {
  const html = verteilung({ FOR: 482, AGAINST: 41, ABSTENTION: 0, DID_NOT_VOTE: 20 }, { zahlenImBalken: true });
  assert.equal((html.match(/class="segment/g) ?? []).length, 3);
  assert.match(html, /flex-grow:482;[^>]*>482</);
  assert.match(html, /flex-grow:41;[^>]*>41</); // 7,6 % – passt noch
  assert.match(html, /flex-grow:20;[^>]*><\/span>/); // 3,7 % – ohne Zahl
  assert.equal((verteilungText({ FOR: 22, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 1 }).match(/class="zahl"/g) ?? []).length, 2);
  assert.equal(verteilungWorte({ FOR: 22, ABSTENTION: 2, DID_NOT_VOTE: 1 }), "22 dafür, 2 Enthaltungen, 1 ohne Stimme");
});

test("Parteien nach Lager: dafür, gespalten, Enthaltung, dagegen, ohne Stimme – innerhalb nach Größe", () => {
  const p = (partei, mehrheit, n) => ({ partei, mehrheit, FOR: n, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0 });
  const sortiert = nachLager([p("A", "AGAINST", 9), p("B", "FOR", 2), p("C", "DID_NOT_VOTE", 1), p("D", "FOR", 20), p("E", "GESPALTEN", 4), p("F", "ABSTENTION", 3)]);
  assert.deepEqual(sortiert.map((x) => x.partei), ["D", "B", "E", "F", "A", "C"]);
});

test("Erklärung: höchstens zwei Stichpunkte, am Wortende gekürzt, mit KI-Hinweis in der Quelle", () => {
  const lang = "Wort ".repeat(60).trim();
  const punkte = erklaerungPunkte(["Kurz.", lang, "Drei."]);
  assert.equal(punkte.length, 2);
  assert.equal(punkte[0], "Kurz.");
  assert.ok(punkte[1].length <= 152 && punkte[1].endsWith("Wort …"));

  const mit = uebersichtHtml({ ...abstimmung([["CDU", 3]]), zusammenfassung: ["Es geht um <Blei>."] }, { titel: "T", css: "" });
  assert.match(mit, /Worum geht es\?/);
  assert.match(mit, /Es geht um &lt;Blei&gt;\./);
  assert.match(mit, /class="ki-quelle"/);
  assert.match(mit, /<span class="absender">Piraten-Check EU<\/span>/);
  const mitSignet = uebersichtHtml(abstimmung([["CDU", 3]]), { titel: "T", css: "", assets: { logos: { "piraten-signet": "file:///s.png" } } });
  assert.match(mitSignet, /<span class="absender"><img src="file:\/\/\/s.png" alt="">Piraten-Check EU<\/span>/);
  const eigen = uebersichtHtml({ ...abstimmung([["CDU", 3]]), zusammenfassung: ["Eigener Text."], erklaerungEigen: true }, { titel: "T", css: "" });
  assert.match(eigen, /Eigener Text\./);
  assert.doesNotMatch(eigen, /ki-quelle/);
  const ohne = uebersichtHtml(abstimmung([["CDU", 3]]), { titel: "T", css: "" });
  assert.doesNotMatch(ohne, /Worum geht es|ki-quelle/);
});

