-- Erweitere die image_slots Tabelle um eine History der URLs
ALTER TABLE public.image_slots 
ADD COLUMN IF NOT EXISTS history_urls JSONB DEFAULT '[]'::jsonb;
