// Erkennt echte Bilddateien an den ersten Bytes – eine Fehler- oder Sperrseite (HTML) darf nicht als Foto landen.
export function bildformat(daten) {
  const b = Buffer.from(daten);
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

// Kurze Beschreibung, was statt eines Bildes kam – für das Protokoll.
export function keinBild(daten, contentType) {
  const anfang = Buffer.from(daten).subarray(0, 60).toString("utf8").replace(/\s+/g, " ").trim();
  return `${contentType || "ohne Content-Type"}, ${Buffer.from(daten).length} Bytes, beginnt mit „${anfang}“`;
}
