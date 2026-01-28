-- Allow authenticated users to upload to images bucket
CREATE POLICY "Authenticated users can upload images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'images');
-- Allow anyone to view images
CREATE POLICY "Anyone can view images" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'images');
-- Allow users to update their own images
CREATE POLICY "Users can update their own images" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'images')
WITH CHECK (bucket_id = 'images');
-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'images');