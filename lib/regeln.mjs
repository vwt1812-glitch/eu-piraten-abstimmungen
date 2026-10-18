// Abweichungen der deutschen Piraten von Markéta Gregorová.
//
// Eine Regel trifft zu, wenn die Abstimmungs-ID in `abstimmungen` steht
// oder eines der `stichworte` in Titel, Sachgebieten oder EuroVoc-Begriffen vorkommt.
//
// Modus:
//   "pruefen"  – nicht automatisch posten, ein Mensch entscheidet
//   "position" – feste Position (`position`: FOR, AGAINST oder ABSTENTION) statt Gregorovás Votum

export function suchtext(abstimmung) {
  return [
    abstimmung.titel,
    abstimmung.verfahren?.titel,
    ...(abstimmung.sachgebiete ?? []),
    ...(abstimmung.eurovoc ?? []),
  ].filter(Boolean).join(" | ").toLowerCase();
}

export function passendeRegeln(abstimmung, regeln) {
  const text = suchtext(abstimmung);
  return regeln.filter((r) => {
    if (r.abstimmungen?.includes(abstimmung.id)) return true;
    return (r.stichworte ?? []).some((s) => text.includes(s.toLowerCase()));
  });
}

// Bestimmt die Piraten-Position und ob automatisch gepostet werden darf.
export function piratenPosition(abstimmung, referenzPosition, regeln) {
  const treffer = passendeRegeln(abstimmung, regeln);
  // Feste Positionen für konkrete Abstimmungen haben Vorrang vor Stichwort-Treffern.
  const fest =
    treffer.find((r) => r.modus === "position" && r.abstimmungen?.includes(abstimmung.id)) ??
    treffer.find((r) => r.modus === "position");

  if (fest) {
    return {
      position: fest.position,
      quelle: "regel",
      status: "automatisch",
      regel: fest.thema,
      hinweis: fest.haltung,
      belege: fest.quelle ? [fest.quelle] : [],
    };
  }

  const pruefen = treffer.find((r) => r.modus === "pruefen");
  if (!referenzPosition || referenzPosition === "DID_NOT_VOTE") {
    return { position: null, quelle: "keine", status: "keine_position", regel: pruefen?.thema ?? null };
  }
  if (pruefen) {
    return {
      position: referenzPosition,
      quelle: "referenz",
      status: "pruefen",
      regel: pruefen.thema,
      hinweis: pruefen.haltung,
      belege: pruefen.quelle ? [pruefen.quelle] : [],
    };
  }
  return { position: referenzPosition, quelle: "referenz", status: "automatisch", regel: null };
}
