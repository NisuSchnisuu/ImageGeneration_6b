-- Füge prompt_history hinzu, um alle Eingaben zu speichern
ALTER TABLE public.image_slots 
ADD COLUMN IF NOT EXISTS prompt_history JSONB DEFAULT '[]'::jsonb;
