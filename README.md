# Schottland Februar 2027

Reise-App für zwei Handys: Route Tag für Tag, Buchungen, Check- und Packliste, Ausgaben, Notizen. Läuft nach dem ersten Öffnen auch offline.

**App:** https://98-cryptooo.github.io/schottland-2027/

## Was wo liegt

| Datei | Inhalt |
|---|---|
| `data.js` | Der Reiseplan. Einzige Stelle für Stopps, Zeiten, Hotels, Listen. Keine Buchungsnummern hier eintragen, das Repo ist öffentlich. |
| `app.js` | Logik, Ansichten, Sync, Exporte |
| `index.html` | Layout und Design |
| `sw.js` | Offline-Cache. Nach jeder Änderung `VERSION` hochzählen. |
| `supabase.sql` | Einmaliges Setup für den gemeinsamen Speicher |

## Gemeinsamer Speicher einrichten (einmalig, ca. 10 Minuten)

1. Auf supabase.com kostenlos registrieren und ein neues Projekt anlegen (Region Frankfurt).
2. Im Projekt links **SQL Editor** öffnen, Inhalt von `supabase.sql` einfügen. In der letzten Zeile `HIER_EUER_REISECODE` durch euren geheimen Reisecode ersetzen, dann **Run**.
3. Unter **Project Settings → API** die **Project URL** und den **anon public key** kopieren.
4. App auf dem ersten Handy öffnen, **Infos → Sync einrichten**: URL, Key und Reisecode eintragen, speichern.
5. **Infos → Link teilen** und den Link privat ans zweite Handy schicken. Einmal öffnen, fertig.

Ohne Einrichtung funktioniert alles, wird aber nur auf dem jeweiligen Gerät gespeichert.

## Als App installieren

Safari öffnen, Teilen, „Zum Home-Bildschirm“. Einmal mit Netz öffnen, danach läuft sie im Flugmodus.

## Testen

`?date=2027-02-20` an die Adresse hängen, um die Heute-Ansicht für einen Reisetag zu sehen.
