import { parteiName } from "./parteien.mjs";
import { piratenPosition } from "./regeln.mjs";

// Zählt die Stimmen der deutschen Abgeordneten je Partei.
// Mehrheit = häufigste Position unter Dafür/Dagegen/Enthaltung, bei Gleichstand "GESPALTEN".
export function parteienAuswerten(stimmen) {
  const parteien = new Map();
  for (const s of stimmen) {
    const name = parteiName(s.partei);
    if (!parteien.has(name)) {
      parteien.set(name, { partei: name, FOR: 0, AGAINST: 0, ABSTENTION: 0, DID_NOT_VOTE: 0 });
    }
    parteien.get(name)[s.position]++;
  }

  return [...parteien.values()]
    .map((p) => ({ ...p, mehrheit: mehrheit(p) }))
    .sort((a, b) => gesamt(b) - gesamt(a) || a.partei.localeCompare(b.partei, "de"));
}

function gesamt(p) {
  return p.FOR + p.AGAINST + p.ABSTENTION + p.DID_NOT_VOTE;
}

function mehrheit(p) {
  const werte = ["FOR", "AGAINST", "ABSTENTION"].map((k) => [k, p[k]]);
  const max = Math.max(...werte.map(([, n]) => n));
  if (max === 0) return "DID_NOT_VOTE";
  const oben = werte.filter(([, n]) => n === max);
  return oben.length > 1 ? "GESPALTEN" : oben[0][0];
}

export function abstimmungAuswerten({ abstimmung, deutsche, referenzPosition, regeln }) {
  return {
    ...abstimmung,
    deutschland: parteienAuswerten(deutsche),
    // Einzelstimmen kompakt: [Abgeordneten-ID, Partei, Position]
    abgeordnete: deutsche.map((s) => [s.id, parteiName(s.partei), s.position]),
    referenzStimme: referenzPosition ?? null,
    piraten: piratenPosition(abstimmung, referenzPosition, regeln),
  };
}
