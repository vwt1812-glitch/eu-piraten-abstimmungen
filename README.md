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
| `data/titel_auto.json` | deutsche Titel von check-some-votes.eu – automatisch |
| `data/titel.json` | deutsche Titel von Hand, haben Vorrang: `{"198216": "Kürzerer Titel"}` |
| `scripts/titel.mjs`, `lib/titel.mjs` | holt die deutschen Titel und ordnet sie zu |
| `data/gepostet.json` | was bereits an Postiz ging – automatisch |
| `lib/auswahl.mjs`, `lib/beitrag.mjs`, `lib/postiz.mjs` | was wann gepostet wird, Texte je Plattform, Postiz-API |
| `scripts/posten.mjs` | plant neue Abstimmungen in Postiz ein |

```sh
npm run abrufen     # ~105 MB Download
npm run auswerten
npm run vorschau -- 5
npm run titel
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

Pro Abstimmung entsteht ein Karussell, jeweils im Format 1080×1350 (`out/<id>/feed/`, für Instagram, Facebook,
X, Bluesky, Mastodon) und 1080×1920 (`out/<id>/hoch/`, für TikTok und Stories). Im Hochformat bleiben oben und
unten Ränder frei, weil TikTok und Instagram dort Bedienelemente einblenden.

1. **Übersicht** – Piraten-Kasten (Fragezeichen-Avatar, weil kein deutscher Pirat im EP sitzt), darunter alle
   deutschen Parteien mit Stimmenzahl und Mehrheitsvotum, unten das Gesamtergebnis.
2. **Abgeordnete** (meist 2 Folien) – alle deutschen Abgeordneten mit Foto und Votum, nach Partei gruppiert.
   Eine Partei wird nie auf zwei Folien verteilt; die Gesichter werden so groß, wie es passt.

Symbole: ✅ Dafür, ❌ Dagegen, ⊖ Enthaltung, N nicht abgestimmt, ✅|❌ Partei gespalten.

**Parteilogos** als `assets/logos/<name>.svg` (oder `.png`/`.webp`) ablegen, z. B. `cdu.svg`, `gruene.svg`,
`freie-waehler.svg`, `die-partei.svg`, `oedp.svg`. Ohne Logo erscheint der Parteiname farbig.
`piraten.svg` erscheint zusätzlich oben rechts in der Ecke jeder Grafik.

Fotos: © Europäische Union (steht auf jeder Grafik).

## Deutsche Titel

HowTheyVote liefert nur englische Titel. `npm run titel` holt die offiziellen deutschen Titel des Europaparlaments
von [check-some-votes.eu](https://check-some-votes.eu) (`/api/votes?lang=de`) und ordnet sie über Tag,
Dokumentkürzel (z. B. `A10-0197/2026`) und Stimmenzahlen zu. Liefert check-some-votes nur den englischen Titel,
wird nichts übernommen. Ergebnis: `data/titel_auto.json`.

Ist ein offizieller Titel zu sperrig, in `data/titel.json` einen eigenen eintragen – der hat Vorrang.

## Posten über Postiz

Einmalig einrichten (GitHub → Settings → Secrets and variables → Actions):

| Art | Name | Wert |
|---|---|---|
| Variable | `POSTIZ_URL` | Adresse der Postiz-Instanz, z. B. `https://postiz.example.org` (die API liegt unter `/api/public/v1`) |
| Secret | `POSTIZ_API_KEY` | API-Key aus Postiz → Einstellungen → Public API |

Gepostet wird auf alle in Postiz verbundenen Kanäle dieser Typen: X, Bluesky, Mastodon, Threads, Telegram,
Facebook, Instagram, TikTok. Andere werden übersprungen.

Ablauf (Action **Posten**, täglich):

1. Kandidaten: Hauptabstimmungen mit Piraten-Position, höchstens 21 Tage alt, noch nicht in `data/gepostet.json`.
2. **Nur mit deutschem Titel** (automatisch oder von Hand). Abstimmungen ohne stehen im Protokoll des Laufs,
   fertig zum Kopieren für `data/titel.json`.
3. Status `automatisch` → geplanter Post, neueste zuerst, höchstens 3 pro Tag und 12 pro Woche, im Abstand von
   2 Stunden. Status `pruefen` → **Entwurf** in Postiz; dort prüfen und freigeben.
4. Pro Post: Text in passender Länge je Plattform (X 280, Bluesky 300, Mastodon/Threads 500, sonst lang),
   alle Grafiken als Karussell mit Alternativtexten – TikTok im Hochformat, sonst 4:5.
5. Zusätzlich eine **Story** mit der Übersicht im Hochformat auf Instagram und Facebook (`stories` in
   `config.json`, nur für geplante Posts, nicht für Entwürfe).

Postiz erlaubt standardmäßig 30 API-Anfragen pro Stunde (`API_LIMIT` in der Postiz-Konfiguration). Eine
Abstimmung braucht etwa 8 (6 Bilder, Post, Story). Mehr als `max_anfragen_pro_lauf` (28) schickt ein Lauf nicht;
der Rest folgt am nächsten Tag.

Limits und Abstand in `config.json` → `posten`. `tiktok_methode`: `DIRECT_POST` (sofort veröffentlichen, braucht
eine von TikTok freigegebene App) oder `UPLOAD` (landet als Entwurf in der TikTok-App).

Vorschau ohne Postiz: `npm run posten -- --trocken` oder die Action mit Häkchen „Nur Vorschau“ starten.

## Automatische Aktualisierung

| Action | Wann | Was |
|---|---|---|
| **Abstimmungen aktualisieren** | sonntags | lädt den Export, schreibt `data/abstimmungen.json`, Vorschau in der Zusammenfassung des Laufs, Grafiken der 3 neuesten Abstimmungen als Download („Artifacts“) |
| **Posten** | täglich | plant neue Abstimmungen in Postiz ein, merkt sie in `data/gepostet.json` |
| **Tests** | bei Pull Requests und Pushes auf `main` | prüft CSV-Leser, Auswertung, Regeln, Posttexte |

## Geplant

- deutsche KI-Zusammenfassungen von check-some-votes.eu im Posttext
- eine Übersichtsseite über GitHub Pages
