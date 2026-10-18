import { test } from "node:test";
import assert from "node:assert/strict";
import { faellig, heute } from "../lib/zeitplan.mjs";

test("Täglicher Lauf: einmal am Tag ab der Uhrzeit, in Berliner Zeit", () => {
  const z = "Europe/Berlin";
  // 07:20 UTC = 09:20 Sommerzeit
  assert.equal(faellig(new Date("2026-10-18T07:20:00Z"), null, "09:30", z), false);
  assert.equal(faellig(new Date("2026-10-18T07:31:00Z"), null, "09:30", z), true);
  assert.equal(faellig(new Date("2026-10-18T07:31:00Z"), "2026-10-18", "09:30", z), false);
  assert.equal(faellig(new Date("2026-10-19T07:31:00Z"), "2026-10-18", "09:30", z), true);
  // 23:30 UTC ist in Berlin schon der nächste Tag
  assert.equal(heute(new Date("2026-10-18T23:30:00Z"), z), "2026-10-19");
  assert.equal(faellig(new Date("2026-10-18T07:31:00Z"), null, "9:30", z), true);
});

import { ortszeit, insZeitfenster } from "../lib/zeitplan.mjs";
import { naechsterTermin } from "../lib/veroeffentlichen.mjs";

const Z = "Europe/Berlin";
const fenster = { von: "09:00", bis: "21:00", zeitzone: Z };

test("Ortszeit → UTC, auch an den Tagen der Zeitumstellung", () => {
  assert.equal(ortszeit("2026-10-18", "09:00", Z).toISOString(), "2026-10-18T07:00:00.000Z"); // Sommerzeit
  assert.equal(ortszeit("2026-12-01", "09:00", Z).toISOString(), "2026-12-01T08:00:00.000Z"); // Winterzeit
  assert.equal(ortszeit("2026-10-25", "09:00", Z).toISOString(), "2026-10-25T08:00:00.000Z"); // Umstellung im Herbst
  assert.equal(ortszeit("2027-03-28", "09:00", Z).toISOString(), "2027-03-28T07:00:00.000Z"); // Umstellung im Frühjahr
});

test("Zeitfenster 9–21 Uhr: nachts auf 9 Uhr verschieben", () => {
  const iso = (d) => insZeitfenster(new Date(d), fenster).toISOString();
  assert.equal(iso("2026-10-18T05:00:00Z"), "2026-10-18T07:00:00.000Z"); // 7 Uhr → 9 Uhr
  assert.equal(iso("2026-10-18T12:00:00Z"), "2026-10-18T12:00:00.000Z"); // 14 Uhr bleibt
  assert.equal(iso("2026-10-18T19:00:00Z"), "2026-10-18T19:00:00.000Z"); // 21:00 bleibt
  assert.equal(iso("2026-10-18T19:30:00Z"), "2026-10-19T07:00:00.000Z"); // 21:30 → morgen 9 Uhr
  assert.equal(iso("2026-10-18T22:30:00Z"), "2026-10-19T07:00:00.000Z"); // 0:30 → 9 Uhr
  assert.equal(iso("2026-10-24T20:00:00Z"), "2026-10-25T08:00:00.000Z"); // 22 Uhr vor der Umstellung
});

test("Nächster Termin: Abstand auch zu schon veröffentlichten Posts, im Zeitfenster", () => {
  const jetzt = new Date("2026-10-18T12:00:00Z"); // 14 Uhr
  // letzter Post vor 30 Minuten → noch 90 Minuten warten
  assert.equal(naechsterTermin({ 1: { typ: "schedule", zeitpunkt: "2026-10-18T11:30:00Z" } }, { jetzt, abstandMinuten: 120, zeitfenster: fenster }), "2026-10-18T13:30:00.000Z");
  // letzter geplanter Post um 20:30 → 22:30 liegt außerhalb → morgen 9 Uhr
  assert.equal(naechsterTermin({ 1: { typ: "schedule", zeitpunkt: "2026-10-18T18:30:00Z" } }, { jetzt, abstandMinuten: 120, zeitfenster: fenster }), "2026-10-19T07:00:00.000Z");
  // Freigabe nachts um 23 Uhr → 9 Uhr
  assert.equal(naechsterTermin({}, { jetzt: new Date("2026-10-18T21:00:00Z"), zeitfenster: fenster }), "2026-10-19T07:00:00.000Z");
  // Entwürfe zählen nicht
  assert.equal(naechsterTermin({ 1: { typ: "draft", zeitpunkt: "2026-10-18T11:59:00Z" } }, { jetzt, zeitfenster: fenster }), "2026-10-18T12:10:00.000Z");
});
