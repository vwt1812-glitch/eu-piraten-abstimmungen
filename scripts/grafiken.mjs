// Rendert die Sharepics: npm run grafiken -- [Abstimmungs-ID …]   (ohne IDs: die 3 neuesten mit Piraten-Position)
// Ergebnis: out/<id>/feed/1-uebersicht.png, 2-abgeordnete.png … und dasselbe in out/<id>/hoch/ (9:16)
import { readFile } from "node:fs/promises";
import { grafikenRendern, mitDeutschemTitel } from "../lib/render.mjs";

const json = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const { abstimmungen } = await json("daten/abstimmungen.json");
const personen = await json("daten/abgeordnete.json");

const ids = process.argv.slice(2).map(Number);
const auswahl = ids.length
  ? ids.map((id) => abstimmungen.find((a) => a.id === id) ?? (() => { throw new Error(`Abstimmung ${id} fehlt`); })())
  : abstimmungen.filter((a) => a.piraten.position).slice(0, 3);

const ergebnis = await grafikenRendern(await mitDeutschemTitel(auswahl), personen);
for (const formate of Object.values(ergebnis)) for (const pngs of Object.values(formate)) for (const png of pngs) console.log(png);
