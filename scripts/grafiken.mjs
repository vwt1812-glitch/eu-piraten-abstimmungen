// Rendert die Sharepics: npm run grafiken -- [Abstimmungs-ID …]   (ohne IDs: die 3 neuesten mit Piraten-Position)
// Ergebnis: out/<id>/1-uebersicht.png, out/<id>/2-abgeordnete.png, 3-abgeordnete.png …
import { readFile } from "node:fs/promises";
import { grafikenRendern, mitDeutschemTitel } from "../lib/render.mjs";

const json = async (p) => JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const { abstimmungen } = await json("data/abstimmungen.json");
const personen = await json("data/abgeordnete.json");

const ids = process.argv.slice(2).map(Number);
const auswahl = ids.length
  ? ids.map((id) => abstimmungen.find((a) => a.id === id) ?? (() => { throw new Error(`Abstimmung ${id} fehlt`); })())
  : abstimmungen.filter((a) => a.piraten.position).slice(0, 3);

const ergebnis = await grafikenRendern(await mitDeutschemTitel(auswahl), personen);
for (const pngs of Object.values(ergebnis)) for (const png of pngs) console.log(png);
