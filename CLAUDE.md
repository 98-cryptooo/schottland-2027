# Schottland 2027: Reise-App

Offline-Web-App (PWA) für Rik und Melina, Schottland-Reise 18. bis 25.02.2027. Läuft auf GitHub Pages: https://98-cryptooo.github.io/schottland-2027/

## Regeln
- Antworten und App-Texte auf Deutsch. Keine Gedankenstriche (– oder —), stattdessen Punkt, Komma oder "bis".
- Knapp antworten, ehrliches Feedback geben, bei Unklarheit kurz nachfragen statt raten.
- Das Repo ist öffentlich: Keine Buchungsnummern, Reisecodes, Supabase-Schlüssel oder andere private Daten committen. Die gehören nur in den Sync-Speicher (Buchungen-Ansicht der App).
- Fakten wie Öffnungszeiten, Preise, Fahrpläne vor dem Eintragen per Websuche prüfen und in `data.js` unter `sources` belegen.
- Adressen für Google Maps immer als vollständige Adresse, nie als Koordinaten (Koordinaten nur in `points` für die schematische Karte).

## Aufbau
- `data.js`: einzige Datenquelle für Plan, Stopps, Zeiten, Hotels, Checkliste, Packliste, Budget. Inhaltliche Änderungen nur hier.
- `app.js`: Ansichten, Sync, ICS- und CSV-Export. Vier Tabs: Heute, Reise (`#route`), Geld, Mehr. Unter Mehr: `#listen` (Packliste), `#fahren`, Notfall, Karten-App, `#planung` mit `#buchen`, `#check`, `#budget`, `#verbinden`.
- Design "Winterlicht": Tokens in `index.html` unter `:root`, Light und Dark. Landschaften als Inline-SVG in `app.js` (`SCENE`, `POST`). Zielgruppe ist auch Melina: wenig auf einmal, keine Technikwörter in ihren Ansichten, Planungskram nur unter Planung.
- `index.html`: Layout und CSS, Systemschriften (Titel in ui-serif), keine externen Ressourcen (offline).
- `sw.js`: Offline-Cache. **Nach jeder Änderung an einer App-Datei `VERSION` hochzählen**, sonst sehen die Handys den alten Stand.
- `supabase.sql`: Setup für den gemeinsamen Speicher. Tabellen sind für den anon-Key gesperrt, Zugriff nur über `sc_pull` und `sc_push` mit Reisecode. Last write wins über den Client-Zeitstempel `ts`.

## Sync-Modell
Alles wird lokal (localStorage) gespeichert und als Einträge `id -> {d, ts, del}` abgeglichen. ID-Präfixe: `todo:`, `pack:`, `citem:` (eigene Listenpunkte), `book:`, `note:`, `exp:`, `set:`. IDs der festen Punkte in `data.js` nicht umbenennen, sonst gehen Haken verloren. Sync läuft beim Laden, beim Tabwechsel, bei `online`, beim Zurückkehren in die App und alle 30 s.

## Testen
- Syntax: `node --check app.js data.js sw.js`
- Zwei-Geräte-Test mit lokaler Postgres und Mock-Supabase: `bash tests/run.sh` (braucht Postgres und Python-Playwright). Prüft Sync in beide Richtungen, Offline, Exporte und Konsolenfehler, legt Screenshots in `tests/` ab.
- Heute-Ansicht für einen Reisetag: `?date=2027-02-20` an die URL hängen, Uhrzeit dazu mit `&time=14:00`.
- Ohne passenden Playwright-Browser: `PW_CHROMIUM=/pfad/zu/chrome bash tests/run.sh`.

## Offen (Stand 17.11.2026)
- Freitag bei der Freundin in Glasgow schlafen oder Hotel?
- Fort William zu dritt: Dreibettzimmer oder zweites Zimmer?
- Parkplatz am JA The Bruntsfield kostenlos?
- Zugzeiten am Glenfinnan-Viadukt für Februar 2027 und mögliche Ersatzbusse.
- Mietwagen-Preise fehlen noch.
