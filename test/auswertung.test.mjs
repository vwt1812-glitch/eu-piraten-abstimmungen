import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseZeile, leseAlle } from "../lib/csv.mjs";
import { parteienAuswerten } from "../lib/auswertung.mjs";
import { piratenPosition } from "../lib/regeln.mjs";
import { posttextLang, posttextKurz, zeichen } from "../lib/posttext.mjs";

const REGELN = [
  { thema: "Kernenergie", modus: "pruefen", stichworte: ["nuclear power"], haltung: "Piraten lehnen Kernenergie ab." },
  { thema: "Beispiel", modus: "position", abstimmungen: [42], position: "AGAINST", haltung: "Eigene Position." },
];

test("CSV: Anführungszeichen, Kommas und Zeilenumbrüche", async () => {
  assert.deepEqual(parseZeile('1,"a, b","sagt ""hallo""",'), ["1", "a, b", 'sagt "hallo"', ""]);

  const dir = await mkdtemp(join(tmpdir(), "csv-"));
  const pfad = join(dir, "t.csv.gz");
  await writeFile(pfad, gzipSync('id,titel\n1,"zwei\nZeilen"\n2,einfach\n'));
  assert.deepEqual(await leseAlle(pfad), [{ id: "1", titel: "zwei\nZeilen" }, { id: "2", titel: "einfach" }]);
});

test("Parteien: Mehrheit, Gleichstand, Namen", () => {
  const p = parteienAuswerten([
    { partei: "GRÜNE.", position: "FOR" },
    { partei: "GRÜNE.", position: "FOR" },
    { partei: "GRÜNE.", position: "AGAINST" },
    { partei: "FDP", position: "FOR" },
    { partei: "FDP", position: "AGAINST" },
    { partei: "V", position: "DID_NOT_VOTE" },
  ]);
  assert.deepEqual(p.map((x) => [x.partei, x.mehrheit]), [
    ["Grüne", "FOR"],
    ["FDP", "GESPALTEN"],
    ["Volt", "DID_NOT_VOTE"],
  ]);
});

test("Piraten-Position: übernimmt Gregorovás Votum", () => {
  const p = piratenPosition({ id: 1, titel: "Digital Services" }, "FOR", REGELN);
  assert.equal(p.position, "FOR");
  assert.equal(p.status, "automatisch");
});

test("Piraten-Position: Stichwort führt zur Prüfung", () => {
  const p = piratenPosition({ id: 2, titel: "x", eurovoc: ["Nuclear power station"] }, "FOR", REGELN);
  assert.equal(p.status, "pruefen");
  assert.equal(p.regel, "Kernenergie");
});

test("Piraten-Position: feste Position für eine Abstimmung", () => {
  const p = piratenPosition({ id: 42, titel: "nuclear power" }, "FOR", REGELN);
  assert.equal(p.position, "AGAINST");
  assert.equal(p.quelle, "regel");
  assert.equal(p.status, "automatisch");
});

test("Piraten-Position: Gregorová hat nicht abgestimmt", () => {
  for (const ref of ["DID_NOT_VOTE", undefined]) {
    const p = piratenPosition({ id: 3, titel: "x" }, ref, REGELN);
    assert.equal(p.position, null);
    assert.equal(p.status, "keine_position");
  }
});

const BEISPIEL = {
  id: 195830,
  zeitpunkt: "2026-09-16 13:22:22",
  titel: "Nuclear decommissioning assistance programme of the Ignalina nuclear power plant in Lithuania ".repeat(4),
  ergebnis: "ADOPTED",
  deutschland: [
    { partei: "CDU", mehrheit: "FOR" },
    { partei: "AfD", mehrheit: "AGAINST" },
    { partei: "BSW", mehrheit: "ABSTENTION" },
  ],
  piraten: { position: "AGAINST", quelle: "regel", hinweis: "Piraten lehnen Kernenergie ab." },
};

test("Posttext: Langfassung enthält Parteien, Position und Quelle", () => {
  const text = posttextLang(BEISPIEL);
  assert.match(text, /16\.09\.2026/);
  assert.match(text, /✅ CDU\n❌ AfD\n⚪ BSW/);
  assert.match(text, /So hätten die Piraten gestimmt: Dagegen\*/);
  assert.match(text, /Abweichend von Markéta Gregorová/);
  assert.match(text, /howtheyvote\.eu\/votes\/195830/);
});

test("Posttext: Kurzfassung passt in 300 Zeichen", () => {
  const text = posttextKurz(BEISPIEL);
  assert.ok(zeichen(text) <= 300, `${zeichen(text)} Zeichen`);
  assert.match(text, /…\n/);
  assert.match(text, /howtheyvote\.eu\/votes\/195830$/);
});

test("Posttext: Langfassung passt in 500 Zeichen", () => {
  const lang = { ...BEISPIEL, titel: BEISPIEL.titel.repeat(3) };
  const text = posttextLang(lang);
  assert.ok(zeichen(text) <= 500, `${zeichen(text)} Zeichen`);
  assert.match(text, /… – angenommen\n/);
});
