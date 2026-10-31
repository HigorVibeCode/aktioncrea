# Crea-Glass Fundgrube – Einzelstücke aus der Ausstellung

Online-Showroom für den Ausstellungsverkauf der Crea-Glass GmbH, Unterseen. Die Seite ist als Erweiterung von crea-glass.ch gebaut: gleicher Kopfbereich mit dem offiziellen Menü, gleiche Schrift (Lato), gleiche Farben, gleiche Abschnittslogik (graue Bänder, Bilder, die ins Band ragen) und derselbe Fussbereich.

- 121 Einzelstücke, neu und unbenutzt, mit Foto, Titel, Details und Preis
- Preise wie im Crea-Glass Shop (Fundgrube); 85 Stücke lassen sich mit «In den Warenkorb» direkt in den offiziellen WooCommerce-Warenkorb legen
- Aktion im November: die fünf Stücke mit dem grössten Preisvorteil, Preis durchgestrichen
- Räume: sechs Bildkacheln, die den Katalog filtern
- Katalog mit Suche, Preisfilter, Sortierung, Kategorien, Merkliste und «Zuletzt angesehen»
- Produktansicht mit Preisaufschlüsselung, «Passt dazu», Lieferung und Montage, Link teilen
- Lieferung & Montage: Standort eingeben, Zone und Richtpreis sofort; Richtpreis wandert in die Anfrage
- Link pro Stück: `#artikel/<id>` oder `#artikel/<Artikelcode>` (für Inserate und Social Media)
- Kontaktformular wie auf der Hauptseite (öffnet das E-Mail-Programm), Karte auf Klick

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitenaufbau, Menü der Hauptseite, Texte |
| `styles.css` | Gestaltung nach crea-glass.ch |
| `app.js` | Katalog, Highlights, Räume, Produktansicht, Merkliste, Anfrage, Warenkorb-Links |
| `services.js` | Tarif für Lieferung und Montage, Zonen, Standortsuche, Distanz, Richtpreis |
| `catalog-data.js` | Produktdaten inkl. Shop-Preis, Shop-Link und Shop-Produkt-ID |
| `assets/crea-glass-logo.svg` | Offizielles Logo (SVG der Hauptseite) |
| `docs/Preisvorschlag_November_2026.xlsx` | Interner Preisvorschlag, Tarif Lieferung & Montage, Montagezeiten, Shop-Abgleich |

Keine Build-Schritte. Direkt als statische Seite veröffentlichen (GitHub Pages, Vercel, Subdomain).

## Tarif anpassen

Alle Beträge für Lieferung und Montage stehen in `services.js` im Objekt `TARIFF`, die Montagezeiten pro Produktgruppe in `INSTALL`. Dieselben Werte stehen im Arbeitsblatt «Annahmen» der Excel-Datei.

## Preise aktualisieren

Die Shop-Preise wurden am 30.10.2026 von crea-glass.ch/shop übernommen. Ändert der Shop Preise, muss `catalog-data.js` nachgeführt werden (Felder `displayPrice`, `shopRegular`, `shopUrl`, `shopId`).

## Link teilen (WhatsApp, Facebook, LinkedIn)

Die Seite liefert Open-Graph-Tags und ein Vorschaubild `assets/og-fundgrube.jpg` (1200 × 630 px, ca. 90 KB). WhatsApp zeigt damit Bild, Titel «Fundgrube – Einzelstücke aus Glas | Crea-Glass» und die Beschreibung.

- Die Adresse steht fest in `index.html` (`og:url`, `og:image`, `canonical`). Wechselt die Domain, diese drei Zeilen anpassen.
- WhatsApp und Facebook speichern die Vorschau einige Tage. Nach einer Änderung hilft: Link mit Zusatz teilen, z. B. `https://aktioncrea.vercel.app/?v=2`, oder die Vorschau bei Facebook neu laden: https://developers.facebook.com/tools/debug/
- Vorschaubild neu bauen: Skript in `docs/og-image.py` (nutzt Foto, Logo und Text).
