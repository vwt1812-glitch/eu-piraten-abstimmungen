// Zeigt die Posttexte der neuesten Abstimmungen: npm run vorschau -- [Anzahl]
import { readFile } from "node:fs/promises";
import { posttextLang, posttextKurz, zeichen } from "../lib/posttext.mjs";

const anzahl = Number(process.argv[2] ?? 5);
const { abstimmungen } = JSON.parse(await readFile(new URL("../daten/abstimmungen.json", import.meta.url)));

for (const a of abstimmungen.filter((a) => a.piraten.position).slice(0, anzahl)) {
  const lang = posttextLang(a);
  const kurz = posttextKurz(a);
  console.log(`──── ${a.id} · Status: ${a.piraten.status}${a.piraten.regel ? ` (${a.piraten.regel})` : ""}`);
  console.log(`[lang, ${zeichen(lang)} Zeichen]\n${lang}\n`);
  console.log(`[kurz, ${zeichen(kurz)} Zeichen]\n${kurz}\n`);
}
