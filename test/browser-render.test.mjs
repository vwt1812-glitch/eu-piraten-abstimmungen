import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { grafikenRendern } from "../lib/render.mjs";

test("Chromium renders a local vote to a full-size PNG", { skip: process.env.RUN_BROWSER_TESTS !== "1" }, async () => {
  const id = "test-browser-render";
  const format = { name: "test", breite: 1080, hoehe: 1080 };
  try {
    const result = await grafikenRendern([{
      id, titel: "Lokaler Browsertest", zeitpunkt: "2026-10-21 12:00:00", ergebnis: "ADOPTED",
      stimmen: { FOR: 1, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0 },
      deutschland: [{ partei: "CDU", FOR: 1, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0, mehrheit: "FOR" }],
      abgeordnete: [[1, "CDU", "FOR"]],
      piraten: { position: "FOR", quelle: "referenz" },
    }], { 1: { vorname: "Erika", nachname: "MUSTER" } }, [format]);
    const files = result[id][format.name];
    assert.equal(files.length, 2);
    for (const file of files) {
      const png = await readFile(file);
      assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      assert.equal(png.readUInt32BE(16), format.breite);
      assert.equal(png.readUInt32BE(20), format.hoehe);
      assert.ok(png.length > 10000);
    }
  } finally {
    await rm(new URL(`../out/${id}/`, import.meta.url), { recursive: true, force: true });
  }
});
