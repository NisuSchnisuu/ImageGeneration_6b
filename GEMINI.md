# Projekt: Nano Banana (Image Creator)

## Überblick
Nano Banana ist eine Webanwendung für den Unterricht, die es Schülern ermöglicht, KI-generierte Bilder über die Google Gemini API zu erstellen. Das System ist geschlossen (Walled Garden), datenschutzfreundlich und pädagogisch strukturiert durch ein "Slot-System".

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend:** Next.js API Routes, Google Gemini API (`google-genai`).
- **Datenbank & Auth:** Supabase (PostgreSQL, Auth, Storage).
- **Sprache:** TypeScript.

## Architektur & Core-Konzepte

### Authentifizierung
- **Admin:** Email/Passwort Login (via Supabase Auth). Zugriff auf `/admin`.
- **Schüler:** Login über Zugangscode (z.B. "X92-B4A") oder QR-Code.
  - *Technisch:* Der Code wird intern zu einer Fake-Email (`CODE@student.local`) und Passwort gemappt, um Supabase Auth Sessions zu nutzen.

### Slot-System (Pädagogisches Limit)
- Jeder Schüler hat **15 Mappen (Slots)**.
- **Regeln:**
  - Pro Slot max. **3 Versuche** (Iterationen).
  - Bilder werden persistent gespeichert, solange der Slot < 3 Versuche hat.
  - Ist der Slot voll (3/3), wird er gesperrt (`is_locked`).
  - Verlässt man einen vollen Slot, werden die Bilder gelöscht (Storage cleanup), aber der Slot bleibt gesperrt (Metadaten bleiben).
  - Admins können Slots wieder entsperren (Unlock).

### Bild-Pipeline
1.  **Generierung:** API Route ruft Gemini Pro Vision (`gemini-3-pro-image-preview`).
2.  **Verarbeitung:** Frontend komprimiert Base64 zu **WebP (80% Quality)**.
3.  **Speicherung:** Upload in Supabase Storage (`images` Bucket). URL wird in DB gespeichert.
4.  **Referenz:** Bilder können als Input (Image-to-Image) wieder an die KI gesendet werden (Download -> Base64 Konvertierung).

## Projektstruktur
- `src/app/api`: Backend-Logik (Generierung, Admin-Tools).
- `src/components`: UI-Komponenten (`StudentDashboard`, `EnhancedGenerator`, `QrScanner`).
- `src/lib`: Hilfsfunktionen (`supabase.ts`, `slots.ts`, `imageUtils.ts`).
- `supabase/migrations`: SQL-Skripte für DB-Schema, RLS und Storage.

## Wichtige Befehle
- `npm run dev`: Startet den Entwicklungsserver.
- SQL-Updates müssen via Supabase SQL Editor ausgeführt werden (Skripte in `supabase/migrations`).
