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
| `data/abstimmungen.json` | Ergebnis – automatisch, **nicht von Hand bearbeiten** |

```sh
npm run abrufen     # ~105 MB Download
npm run auswerten
npm run vorschau -- 5
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

## Automatische Aktualisierung

| Action | Wann | Was |
|---|---|---|
| **Abstimmungen aktualisieren** | sonntags | lädt den Export, schreibt `data/abstimmungen.json`, Vorschau in der Zusammenfassung des Laufs |
| **Tests** | bei Pull Requests und Pushes auf `main` | prüft CSV-Leser, Auswertung, Regeln, Posttexte |

## Geplant

- Posten über Postiz (Langfassung Mastodon, Kurzfassung Bluesky), Abstimmungen mit `pruefen` nur nach Freigabe
- deutsche Titel (HowTheyVote liefert nur englische)
- Sharepics und eine Übersichtsseite über GitHub Pages
