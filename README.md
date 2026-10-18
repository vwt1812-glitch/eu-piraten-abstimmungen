# EU-Piraten-Abstimmungen

Wie stimmen die deutschen Abgeordneten im Europaparlament ab – und wie hätten die Piraten gestimmt?

Seit 2024 sitzt keine deutsche Piratin und kein deutscher Pirat im Europaparlament. Die Piraten-Position wird daher
vom Votum der tschechischen Piratin **Markéta Gregorová** (Piráti) abgeleitet. Bei Themen, bei denen die deutschen
Piraten anders stehen (z. B. Kernenergie), greifen Regeln aus `abweichungen.json`.

Daten: [HowTheyVote.eu](https://howtheyvote.eu) (namentliche Abstimmungen, wöchentlicher Export).

## Aufbau

| Datei | Inhalt |
|---|---|
| `config.json` | Referenz-Abgeordnete, Land, Zeitraum, Datenquelle |
| `abweichungen.json` | Themen, bei denen die deutschen Piraten von Gregorová abweichen |
| `lib/` | CSV-Leser, Auswertung, Regeln, Posttexte |
| `scripts/abrufen.mjs` | lädt die Tabellen von HowTheyVote.eu nach `cache/` (nicht im Repo) |
| `scripts/auswerten.mjs` | schreibt `data/abstimmungen.json` |
| `scripts/vorschau.mjs` | zeigt die Posttexte der neuesten Abstimmungen |
| `scripts/portraets.mjs` | lädt die Porträts der Abgeordneten vom Europaparlament nach `cache/portraets/` |
| `scripts/grafiken.mjs` | rendert die Sharepics nach `out/<id>/` |
| `lib/grafik.mjs`, `assets/grafik.css` | Aufbau und Gestaltung der Sharepics |
| `assets/logos/` | Parteilogos (siehe unten) |
| `data/abstimmungen.json` | Ergebnis – automatisch, **nicht von Hand bearbeiten** |
| `data/abgeordnete.json` | Namen der Abgeordneten – automatisch |
| `data/titel.json` | deutsche Titel, von Hand: `{"198216": "Deutscher Titel"}` |

```sh
npm run abrufen     # ~105 MB Download
npm run auswerten
npm run vorschau -- 5
npm run portraets
npm run grafiken -- 198216   # ohne ID: die 3 neuesten
npm test
```

Ausgewertet werden nur **Hauptabstimmungen** (Schlussabstimmung bzw. Gesamttext), keine einzelnen Änderungsanträge.

## Status je Abstimmung

| Status | Bedeutung |
|---|---|
| `automatisch` | Piraten-Position = Gregorovás Votum (oder feste Position aus einer Regel) – darf automatisch gepostet werden |
| `pruefen` | ein Stichwort aus `abweichungen.json` passt – vor dem Posten entscheidet ein Mensch |
| `keine_position` | Gregorová hat nicht abgestimmt – kein Post |

## Abweichungen

```json
{
  "thema": "Kernenergie",
  "modus": "pruefen",
  "stichworte": ["nuclear energy", "nuclear power"],
  "haltung": "Die deutschen Piraten lehnen Kernenergie ab – Votum vor dem Posten prüfen.",
  "quelle": "Link ins Parteiprogramm"
}
```

Gesucht wird (ohne Groß-/Kleinschreibung) in Titel, Verfahrenstitel, Sachgebieten und EuroVoc-Begriffen – die sind
englisch, Stichworte also englisch angeben.

Nach der Prüfung eine Abstimmung fest entscheiden:

```json
{
  "thema": "Kernenergie",
  "modus": "position",
  "abstimmungen": [177733],
  "position": "AGAINST",
  "haltung": "Die deutschen Piraten lehnen Kernenergie als Teil der Versorgungssicherheit ab.",
  "quelle": "Link ins Parteiprogramm"
}
```

`position`: `FOR`, `AGAINST` oder `ABSTENTION`. Im Post erscheint die Position dann mit Sternchen und Hinweis
„Abweichend von Markéta Gregorová“.

## Grafiken

Pro Abstimmung entsteht ein Karussell im Format 1080×1350:

1. **Übersicht** – Piraten-Kasten (Fragezeichen-Avatar, weil kein deutscher Pirat im EP sitzt), darunter alle
   deutschen Parteien mit Stimmenzahl und Mehrheitsvotum, unten das Gesamtergebnis.
2. **Abgeordnete** (meist 2 Folien) – alle deutschen Abgeordneten mit Foto und Votum, nach Partei gruppiert.
   Eine Partei wird nie auf zwei Folien verteilt; die Gesichter werden so groß, wie es passt.

Symbole: ✅ Dafür, ❌ Dagegen, ⊖ Enthaltung, N nicht abgestimmt, ✅|❌ Partei gespalten.

**Parteilogos** als `assets/logos/<name>.svg` (oder `.png`/`.webp`) ablegen, z. B. `cdu.svg`, `gruene.svg`,
`freie-waehler.svg`, `die-partei.svg`, `oedp.svg`, `piraten.svg`. Ohne Logo erscheint der Parteiname farbig.

Fotos: © Europäische Union (steht auf jeder Grafik).

## Automatische Aktualisierung

| Action | Wann | Was |
|---|---|---|
| **Abstimmungen aktualisieren** | sonntags | lädt den Export, schreibt `data/abstimmungen.json`, Vorschau in der Zusammenfassung des Laufs, Grafiken der 3 neuesten Abstimmungen als Download („Artifacts“) |
| **Tests** | bei Pull Requests und Pushes auf `main` | prüft CSV-Leser, Auswertung, Regeln, Posttexte |

## Geplant

- Posten über Postiz (Langfassung Mastodon, Kurzfassung Bluesky), Abstimmungen mit `pruefen` nur nach Freigabe
- deutsche Titel automatisch (HowTheyVote liefert nur englische; check-some-votes.eu hat deutsche Zusammenfassungen)
- Hochformat 1080×1920 für TikTok und Stories
- eine Übersichtsseite über GitHub Pages
