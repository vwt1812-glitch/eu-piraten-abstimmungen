# EU-Piraten-Abstimmungen

Wie stimmen die deutschen Abgeordneten im Europaparlament ab – und wie hätten die PIRATEN gestimmt?

Seit 2024 sitzt keine deutsche Piratin und kein deutscher Pirat im Europaparlament. Die Position der PIRATEN wird
daher vom Votum der tschechischen Piratin **Markéta Gregorová** (Piráti) abgeleitet. Bei Themen, bei denen die
deutschen PIRATEN anders stehen (z. B. Kernenergie), greifen Regeln aus `abweichungen.json`, und vor jedem Post
entscheidet ein Mensch über Telegram.

Daten: [HowTheyVote.eu](https://howtheyvote.eu) (namentliche Abstimmungen, wöchentlicher Export), deutsche Titel
von [check-some-votes.eu](https://check-some-votes.eu), Fotos © Europäische Union.

## Ablauf

Ein Dienst auf einem Raspberry Pi (`scripts/bot.mjs`) erledigt alles:

1. **Täglich** (`config.json` → `zeitplan`, Standard 9:30 Uhr): neuen Export von HowTheyVote laden (nur wenn es
   einen gibt), auswerten, deutsche Titel holen, Porträts laden und neue Abstimmungen **als Vorschau nach
   Telegram** schicken.
2. **In Telegram** zu jeder Vorschau: ✅ Ja, ❌ Nein oder ✏️ Ändern.
3. Nach ✅ plant der Dienst den Post sofort in **Postiz** ein, Postiz veröffentlicht auf allen Kanälen.

## Einrichtung auf dem Raspberry Pi

Raspberry Pi OS Lite 64-bit; empfohlen ist ein Pi 4 oder 5 mit mindestens 2 GB RAM (für Chromium beim Rendern).

```sh
git clone https://github.com/vwt1812-glitch/eu-piraten-abstimmungen.git
cd eu-piraten-abstimmungen
bash pi/install.sh
```

Das Skript installiert Node.js 22, Chromium und Schriften, die Abhängigkeiten und den Dienst `eu-piraten`
(systemd). Danach:

1. **Telegram-Bot anlegen:** in Telegram [@BotFather](https://t.me/BotFather) → `/newbot`, den Token merken.
2. **Zugangsdaten eintragen:** `sudo nano /etc/eu-piraten.env`
   - `POSTIZ_URL` – Adresse der Postiz-Instanz, z. B. `https://postiz.example.org` (die API liegt unter `/api/public/v1`)
   - `POSTIZ_API_KEY` – aus Postiz → Einstellungen → Public API
   - `TELEGRAM_BOT_TOKEN` – von BotFather
   - `TELEGRAM_CHAT_ID` – erst einmal leer lassen
   - `POSTIZ_KANAELE` – **nur auf diesen Kanälen wird gepostet**: Name, Profil oder ID, kommagetrennt
     (z. B. `PIRATEN EU, @piraten_eu_bsky`), und/oder `POSTIZ_KUNDE` – alle Kanäle eines Postiz-„Kunden“.
     Ohne Auswahl wird nichts gepostet. Welche Kanäle es gibt, zeigt der Bot mit `/kanaele`.
3. `sudo systemctl start eu-piraten` und dem Bot in Telegram schreiben. Er antwortet mit der **Chat-ID**. Die in
   `/etc/eu-piraten.env` eintragen und `sudo systemctl restart eu-piraten`. Nur dieser Chat darf freigeben – das
   kann auch eine Gruppe sein, dann kann das ganze Team freigeben.

| Befehl | |
|---|---|
| `journalctl -u eu-piraten -f` | Protokoll ansehen |
| `sudo systemctl restart eu-piraten` | Dienst neu starten (z. B. nach Änderung der Zugangsdaten) |
| `bash pi/aktualisieren.sh` | neuen Code von GitHub holen und neu starten |

Fehler im täglichen Lauf oder beim Einplanen meldet der Bot in Telegram, ebenso (jeweils einmal):

- **Unbekannte Partei** – ein Abgeordneter ist zu einer Partei gewechselt, für die es noch keinen Anzeigenamen gibt.
  Dann in `lib/parteien.mjs` (Name), `lib/grafik.mjs` (Farbe) und `assets/logos/` (Logo) ergänzen.
- **Gregorová stimmt nicht mehr ab** – an den letzten 4 Abstimmungstagen keine Stimme (`config.json` → `referenz`
  → `warnen_nach_sitzungstagen`). Solange gibt es keine Vorschläge. Ist sie ausgeschieden, unter `referenz` eine
  andere Abgeordnete eintragen.

Parteiwechsel, Ausscheiden und Nachrücken sonst brauchen nichts: HowTheyVote speichert die Partei zu jeder
einzelnen Abstimmung, Nachrücker erscheinen automatisch mit Namen und Foto.

Erzeugte Daten liegen auf dem Pi in `daten/`, Downloads in `cache/`, Grafiken in `out/` – alle drei sind nicht
im Repository.

## Freigabe in Telegram

Jede vorgeschlagene Abstimmung kommt mit allen Grafiken (Feed-Karussell + Übersicht im Hochformat), dem Posttext,
der Kurzfassung, dem englischen Originaltitel und drei Knöpfen:

- **✅ Ja, posten** – wird in Postiz eingeplant (nächster freier Termin, siehe unten); der Bot meldet Zeitpunkt
  und Kanäle.
- **❌ Nein** – wird nie gepostet.
- **✏️ Ändern** – der Bot fragt nach. Auf die Frage (oder die Vorschau) antworten mit
  - einem neuen Titel, einfach als Text,
  - `position: dafür` / `dagegen` / `enthaltung` – z. B. bei Kernenergie,
  - `hinweis: …` – Begründung, erscheint im Post als „Abweichend von Markéta Gregorová: …“,
  - `erklaerung: …` – eigener Text für „Worum geht es?“ statt der KI-Zusammenfassung (jede Zeile ein Stichpunkt,
    ohne KI-Hinweis),
  - `erklaerung: aus` – „Worum geht es?“ weglassen.

  Danach kommt eine neue Vorschau mit den Änderungen, wieder mit ✅/❌/✏️.

Prüffälle aus `abweichungen.json` (z. B. Kernenergie) bekommen einen ⚠️-Hinweis.

Befehle: `/status` (was offen ist), `/jetzt` (täglichen Lauf sofort starten), `/kanaele` (auf welchen
Postiz-Kanälen gepostet wird), `/hilfe`.

## Was gepostet wird

1. Hauptabstimmungen (Schlussabstimmung bzw. Gesamttext, keine Änderungsanträge) mit Position der PIRATEN,
   höchstens 21 Tage alt, noch nicht vorgeschlagen.
2. **Nur mit deutschem Titel.** Abstimmungen ohne stehen im Protokoll, fertig zum Kopieren für `titel.json`.
3. Neueste zuerst, höchstens 3 Vorschläge pro Tag und 12 pro Woche (`config.json` → `posten`).
4. **Wann:** nur zwischen 9 und 21 Uhr (`zeitfenster`, Berliner Zeit) und mindestens 2 Stunden nach dem letzten
   Post (`abstand_minuten`), auch wenn der schon veröffentlicht ist. Wer abends nach 21 Uhr freigibt, sieht den
   Post am nächsten Morgen um 9 Uhr.
5. Pro Post: Text in passender Länge je Plattform (Kurzfassung für X, Bluesky und Threads, sonst lang – gezählt
   wie Postiz: meist JavaScript-Zeichen, bei Threads Bytes, bei X gewichtet), alle
   Grafiken als Karussell mit Alternativtexten – TikTok im Hochformat, sonst 4:5. Zusätzlich eine **Story** mit
   der Übersicht auf Instagram und Facebook (`stories`).

Kanäle: nur die in `POSTIZ_KANAELE` / `POSTIZ_KUNDE` ausgewählten – andere Accounts in Postiz bleiben unberührt.
Unterstützt sind X, Bluesky, Mastodon, Threads, Telegram, Facebook, Instagram und TikTok; ausgewählte Kanäle
anderer Typen oder deaktivierte werden übersprungen und in `/kanaele` gemeldet.

Postiz erlaubt standardmäßig 30 API-Anfragen pro Stunde (`API_LIMIT` in der Postiz-Konfiguration); eine
Abstimmung braucht etwa 8. Der Dienst zählt mit (`max_anfragen_pro_stunde`, 28) und plant den Rest später ein.

`tiktok_methode`: `DIRECT_POST` (sofort veröffentlichen, braucht eine von TikTok freigegebene App) oder `UPLOAD`
(landet als Entwurf in der TikTok-App).

Ohne `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` plant `npm run posten` direkt in Postiz ein (Prüffälle als Entwurf).

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
englisch, Stichworte also englisch angeben. Eine Abstimmung fest entscheiden:

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

`position`: `FOR`, `AGAINST` oder `ABSTENTION`. Im Post erscheint sie mit Sternchen und „Abweichend von Markéta
Gregorová“. Meist ist das nicht nötig – in Telegram reicht `position: dagegen`.

| Status | Bedeutung |
|---|---|
| `automatisch` | Position = Gregorovás Votum (oder feste Position aus einer Regel) |
| `pruefen` | ein Stichwort aus `abweichungen.json` passt – Vorschau mit ⚠️ |
| `keine_position` | Gregorová hat nicht abgestimmt – kein Vorschlag |

## Grafiken

Pro Abstimmung ein Karussell, im Format 1080×1350 (`out/<id>/feed/`) und 1080×1920 (`out/<id>/hoch/`, für TikTok
und Stories, mit freien Rändern für die Bedienelemente der Apps):

1. **Übersicht** – Kasten der PIRATEN (Fragezeichen-Avatar, weil kein deutscher Pirat im EP sitzt), alle deutschen
   Parteien mit Stimmenzahl und Mehrheitsvotum, Gesamtergebnis.
2. **Abgeordnete** (meist 2 Folien) – alle deutschen Abgeordneten mit Foto und Votum, nach Partei gruppiert.

Symbole: ✅ Dafür, ❌ Dagegen, ⊖ Enthaltung, N nicht abgestimmt, ✅|❌ Partei gespalten.

**Parteilogos** als `assets/logos/<name>.svg` (oder `.png`/`.webp`), z. B. `cdu.svg`, `gruene.svg`,
`freie-waehler.svg`, `die-partei.svg`, `oedp.svg`. Ohne Logo erscheint der Parteiname farbig.
`piraten.png` steht im Kasten der PIRATEN, das runde `piraten-signet.png` oben rechts in der Ecke jeder Grafik.

## Deutsche Titel

`npm run titel` holt die offiziellen deutschen Titel des Europaparlaments von check-some-votes.eu
(`/api/votes?lang=de`) und ordnet sie über Tag, Dokumentkürzel (z. B. `A10-0197/2026`) und Stimmenzahlen zu.
Liefert check-some-votes nur den englischen Titel, wird nichts übernommen.

Außerdem holt `npm run titel` die **deutsche KI-Zusammenfassung** von check-some-votes
(`/api/v1/social/vote-card.json`) nach `daten/zusammenfassungen.json`. Die gibt es nur für Abstimmungen mit
Bericht; fehlende werden täglich erneut gefragt. Auf der Übersicht steht sie als „Worum geht es?“ (im Feed bis zu
zwei, im Hochformat bis zu drei Stichpunkte, gekennzeichnet als KI-generiert). Wird es zu eng, fallen beim Rendern
erst Stichpunkte und zuletzt die ganze Erklärung weg – die Ergebnisse der Parteien haben Vorrang. In der
Telegram-Vorschau steht die Zusammenfassung vollständig.

Eigene Titel: in Telegram per ✏️ Ändern, oder dauerhaft in `titel.json` (`{"198216": "Kürzerer Titel"}`) – die
haben Vorrang.

## Dateien

| Datei | Inhalt |
|---|---|
| `config.json` | Referenz-Abgeordnete, Datenquellen, Limits, Zeitplan |
| `abweichungen.json` | Themen, bei denen die deutschen PIRATEN von Gregorová abweichen |
| `titel.json` | eigene deutsche Titel |
| `scripts/bot.mjs` | der Dienst: Telegram, täglicher Lauf, Einplanen |
| `scripts/abrufen.mjs` | lädt die Tabellen von HowTheyVote.eu nach `cache/` (~105 MB, nur bei neuem Export) |
| `scripts/auswerten.mjs` | schreibt `daten/abstimmungen.json` und `daten/abgeordnete.json` |
| `scripts/titel.mjs` | schreibt `daten/titel_auto.json` und `daten/zusammenfassungen.json` |
| `scripts/portraets.mjs` | lädt die Porträts nach `cache/portraets/` |
| `scripts/posten.mjs` | Vorschauen nach Telegram, Freigegebenes nach Postiz |
| `scripts/grafiken.mjs`, `scripts/vorschau.mjs` | Grafiken bzw. Posttexte zum Ansehen |
| `lib/` | Auswertung, Regeln, Titel, Grafiken, Posttexte, Postiz und Kanalauswahl, Telegram, Freigabe |
| `assets/` | Gestaltung der Grafiken, Logos |
| `pi/` | Installation und Dienst für den Raspberry Pi |

Zum Ausprobieren auf dem eigenen Rechner:

```sh
npm ci
npm run abrufen && npm run auswerten && npm run titel && npm run portraets
npm run grafiken -- 198216        # ohne ID: die 3 neuesten
npm run posten -- --neue --trocken
npm test
```

Auf GitHub laufen bei jedem Push nur die Tests.

## Geplant

- eine Übersichtsseite über GitHub Pages
