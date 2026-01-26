-- Allow Admins to Delete ANY file in "images" bucket
-- Current policy only allows "owner" to delete.

CREATE POLICY "Admins can delete any image" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
