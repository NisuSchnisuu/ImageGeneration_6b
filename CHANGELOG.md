# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [Unreleased] - 2026-01-19

### Hinzugefügt
- **Supabase Storage Integration:** Bilder werden nun persistent im `images` Bucket gespeichert (WebP Format) statt nur flüchtig als Base64.
- **Admin Dashboard:**
  - Übersicht aller Schüler.
  - Generierung von QR-Codes (inkl. Auto-Login URL).
  - Detailansicht pro Schüler (Einsicht in alle 15 Slots).
  - "Unlock"-Funktion für gesperrte Slots.
  - Prompt-Historie zur pädagogischen Einsicht.
- **Student Dashboard:**
  - Grid-Ansicht mit 15 Slots ("Mappen").
  - Status-Anzeige (Offen, In Bearbeitung, Geschlossen).
  - Galerie-Funktion innerhalb eines Slots (History der letzten 3 Bilder).
  - Image-to-Image: Hochladen eigener Bilder oder Nutzen generierter Bilder als Referenz.
  - Aspect Ratio Auswahl (1:1, 16:9, etc.).
  - Download-Funktion ohne Tab-Wechsel.
- **Datenbank:**
  - Neue Spalten `history_urls` und `prompt_history` in `image_slots`.
  - SQL-Migrationen für Storage Policies und Trigger.

### Geändert
- **Slot-Logik:** Slots verhalten sich nun wie persistente Sessions. Bilder bleiben erhalten, bis der Slot voll (3/3) ist und abgeschlossen wird.
- **Generator:** Umstellung auf `gemini-3-pro-image-preview` (Nano Banana Pro) als Standard. Flash-Modell entfernt.
- **Login:** Implementierung eines QR-Code Scanners mit Auto-Login Logik via URL-Parameter.

### Behoben
- **Referenz-Bild Bug:** Fehler beim Senden von Supabase-URLs an die Gemini API behoben (Konvertierung URL -> Base64 vor API-Call).
- **Galerie-Anzeige:** Bilder werden nun vollständig angezeigt (`object-contain`), unabhängig vom Format.
