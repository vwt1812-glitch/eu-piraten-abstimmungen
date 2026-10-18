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
