-- 1. Erstelle den Bucket für Bilder
INSERT INTO storage.buckets (id, name, public) 
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS für Storage aktivieren
-- Erlaube Uploads für authentifizierte User (Schüler)
CREATE POLICY "Users can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');

-- Erlaube jedem das Lesen (da der Bucket public ist, aber wir machen es explizit)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'images');

-- Erlaube Löschen durch den Besitzer
CREATE POLICY "Users can delete own images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'images' AND (auth.uid() = owner));
