-- 1. Funktion sicherstellen
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- 2. WICHTIG: Ausführungsrechte vergeben (Das hat evtl. gefehlt)
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- 3. Policy erneuern
DROP POLICY IF EXISTS "Admin_2 read images" ON storage.objects;

CREATE POLICY "Admin_2 read images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'images' AND
  (public.get_my_role() = 'admin_2')
);