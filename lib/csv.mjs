import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

// Zerlegt eine CSV-Zeile. Felder in Anführungszeichen dürfen Kommas und "" enthalten.
export function parseZeile(zeile) {
  if (!zeile.includes('"')) return zeile.split(",");
  const felder = [];
  let feld = "";
  let inQuotes = false;
  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i];
    if (inQuotes) {
      if (z === '"' && zeile[i + 1] === '"') { feld += '"'; i++; }
      else if (z === '"') inQuotes = false;
      else feld += z;
    } else if (z === '"') inQuotes = true;
    else if (z === ",") { felder.push(feld); feld = ""; }
    else feld += z;
  }
  felder.push(feld);
  return felder;
}

// Liest eine (gzip-)CSV-Datei zeilenweise als Objekte.
// Zeilenumbrüche innerhalb von Anführungszeichen werden zusammengeführt.
export async function* leseCsv(pfad) {
  let stream = createReadStream(pfad);
  if (pfad.endsWith(".gz")) stream = stream.pipe(createGunzip());
  const zeilen = createInterface({ input: stream, crlfDelay: Infinity });

  let kopf = null;
  let puffer = null;
  for await (const zeile of zeilen) {
    const text = puffer === null ? zeile : puffer + "\n" + zeile;
    if ((text.split('"').length - 1) % 2 === 1) { puffer = text; continue; }
    puffer = null;
    const felder = parseZeile(text);
    if (!kopf) { kopf = felder; continue; }
    const obj = {};
    for (let i = 0; i < kopf.length; i++) obj[kopf[i]] = felder[i] ?? "";
    yield obj;
  }
}

export async function leseAlle(pfad, filter = () => true) {
  const rows = [];
  for await (const row of leseCsv(pfad)) if (filter(row)) rows.push(row);
  return rows;
}
