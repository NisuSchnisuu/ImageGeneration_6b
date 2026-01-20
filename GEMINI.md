# Projekt: Nano Banana (Image Creator)

## Überblick
Nano Banana ist eine Webanwendung für den Unterricht, die es Schülern ermöglicht, KI-generierte Bilder über die Google Gemini API zu erstellen. Das System ist geschlossen (Walled Garden), datenschutzfreundlich und pädagogisch strukturiert durch ein "Slot-System".

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend:** Next.js API Routes, Google Gemini API (`google-genai`).
- **Datenbank & Auth:** Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **Sprache:** TypeScript.

## Architektur & Core-Konzepte

### Authentifizierung
- **Admin:** Email/Passwort Login (via Supabase Auth). Zugriff auf `/admin`.
- **Schüler:** Login über Zugangscode (z.B. "X924-B4A1-229Z") oder QR-Code.
  - *Technisch:* Der Code wird intern zu einer Fake-Email (`CODE@student.local`) und Passwort gemappt, um Supabase Auth Sessions zu nutzen.
  - **Global Lock:** Der Lehrer kann das System global sperren. Eingeloggte Schüler werden sofort ausgeloggt.

### Slot-System (Pädagogisches Limit)
- Jeder Schüler hat **16 Mappen (Slots)**.
  - **Slot 0 (Titelbild):** Standardmäßig 2:3 Format ("Ganze Seite").
  - **Slots 1-15:** Standardmäßig 1:1 Format.
- **Regeln:**
  - Pro Slot max. **3 Versuche** (Iterationen).
  - Bilder werden persistent gespeichert, solange der Slot < 3 Versuche hat.
  - Ist der Slot voll (3/3), wird er gesperrt (`is_locked`).
  - Verlässt man einen vollen Slot, werden die Bilder gelöscht (Storage cleanup), aber der Slot bleibt gesperrt (Metadaten bleiben).
  - Admins können Slots wieder entsperren (Unlock).

### Bild-Pipeline
1.  **Generierung:** Supabase Edge Function (`bild-generieren`) ruft Gemini Pro Vision.
2.  **Verarbeitung:** Frontend komprimiert Base64 zu **WebP (80% Quality)**.
3.  **Speicherung:** Upload in Supabase Storage (`images` Bucket). URL wird in DB gespeichert.
4.  **Referenz:** Bilder können als Input (Image-to-Image) wieder an die KI gesendet werden (Download -> Base64 Konvertierung).
5.  **Live-Status:** Wenn ein Schüler generiert, sieht der Lehrer im Admin-Dashboard ein blinkendes "Aktiv"-Signal.

### Guardrail & Safety (Schutzmaßnahmen)
- **Modell:** `gemini-2.5-flash` prüft jeden Prompt VOR der Bildgenerierung.
- **Text-Restriction:**
  - **Slot 0 (Titelbild):** Textanfragen (z.B. "Ein Schild mit 'Hallo'") sind erlaubt.
  - **Slots 1-15:** Textanfragen werden blockiert. Es erscheint ein Popup ("Ich erstelle dir keinen Text...").
- **Safety-Filter:** Blockiert Gewalt, Hassrede, Sexuelles etc. ("Ich kann das nicht erstellen...").
- **Feedback:** Fehler werden als Popup im Frontend angezeigt und müssen manuell geschlossen werden.

## Projektstruktur
- `src/app/api`: Legacy Backend-Logik (nun größtenteils in Edge Functions).
- `supabase/functions`: Deno Edge Functions für `admin-create-student` und `bild-generieren`.
- `src/components`: UI-Komponenten (`StudentDashboard`, `EnhancedGenerator`, `QrScanner`).
- `src/lib`: Hilfsfunktionen (`supabase.ts`, `slots.ts`, `imageUtils.ts`).
- `supabase/migrations`: SQL-Skripte für DB-Schema, RLS, Storage und App-Settings.

## Wichtige Befehle
- `npm run dev`: Startet den Entwicklungsserver.
- `npx supabase functions deploy <name> --no-verify-jwt`: Aktualisiert Edge Functions.
- SQL-Updates müssen via Supabase SQL Editor ausgeführt werden.
