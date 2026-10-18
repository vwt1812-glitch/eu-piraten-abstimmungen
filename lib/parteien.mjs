// Kurzbezeichnungen aus HowTheyVote → Anzeige.
const NAMEN = {
  "CDU": "CDU",
  "CSU": "CSU",
  "SPD": "SPD",
  "AfD": "AfD",
  "GRÜNE.": "Grüne",
  "FDP": "FDP",
  "DIE LINKE.": "Linke",
  "Bündnis Sahra": "BSW",
  "BSW": "BSW",
  "Freie Wähler": "Freie Wähler",
  "V": "Volt",
  "Die PARTEI": "Die PARTEI",
  "ÖDP": "ÖDP",
  "Familien-Partei DE": "Familie",
  "Die Tierschutzpartei": "Tierschutz",
  "PdF": "PdF",
  "Piratenpartei DE": "PIRATEN",
  "Independent": "Parteilos",
};

export function parteiName(kurz) {
  return NAMEN[kurz] ?? kurz;
}

export const POSITIONEN = {
  FOR: "Dafür",
  AGAINST: "Dagegen",
  ABSTENTION: "Enthaltung",
  DID_NOT_VOTE: "Nicht abgestimmt",
};

export const SYMBOLE = {
  FOR: "✅",
  AGAINST: "❌",
  ABSTENTION: "⚪",
  GESPALTEN: "↔️",
};
