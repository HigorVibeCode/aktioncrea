# Crea-Glass Ausstellungsverkauf – November 2026

Statischer, responsiver Produktkatalog für den Ausstellungsverkauf der Crea-Glass GmbH, Unterseen.

- 121 Positionen mit quadratischen Produktbildern; alle Stücke sind neu und unbenutzt (Ausstellungsstücke)
- 117 verfügbare Stücke und vier sichtbar als verkauft markierte Artikel
- Fünf bestätigte Aktionspreise, Katalogpreise als Richtwert und 20 Glasplatten mit Preis auf Anfrage
- Suche, Kategorien, Verfügbarkeitsfilter, Anfragekorb und direkter Kontakt über WhatsApp, E-Mail oder Telefon
- Link pro Stück: `index.html#artikel/<id>` oder `#artikel/<Artikelcode>` öffnet das Produkt direkt (für Inserate auf tutti, ricardo, Social Media)
- Lieferung & Montage: Standort eingeben (PLZ, Adresse oder Gerätestandort), Zone und Richtpreis werden sofort angezeigt und in die Anfrage übernommen

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenaufbau und Texte |
| `styles.css` | Gestaltung, Animationen, mobile Ansicht |
| `app.js` | Katalog, Anfragekorb, Produktdialog, Links pro Stück, Anfrage-Texte |
| `services.js` | Tarif für Lieferung und Montage, Zonen, Standortsuche, Distanz, Richtpreis |
| `catalog-data.js` | Produktdaten (Titel, Untertitel, Details, Preise, Bilder) |
| `docs/Preisvorschlag_November_2026.xlsx` | Interner Preisvorschlag pro Stück, Tarif Lieferung & Montage, Montagezeiten, Annahmen |

Die Website benötigt keinen Build-Schritt und kann als GitHub Pages Site direkt aus dem Hauptverzeichnis veröffentlicht werden.

## Tarif anpassen

Alle Beträge für Lieferung und Montage stehen in `services.js` im Objekt `TARIFF` (Stundensatz, Zonen, Gratislieferung ab Warenwert, Postversand). Die Montagezeiten pro Produktgruppe stehen im Objekt `INSTALL`. Dieselben Werte stehen im Arbeitsblatt «Annahmen» der Excel-Datei.

## Standortsuche

Die Standortsuche nutzt `api3.geo.admin.ch` (Schweizer Adressen, ohne Schlüssel), als Ersatz OpenStreetMap Nominatim und zuletzt eine eingebaute PLZ-Tabelle. Die Strassendistanz kommt von OSRM; fällt der Dienst aus, wird die Luftlinie mit Faktor 1,35 verwendet und als «ca.» gekennzeichnet.
