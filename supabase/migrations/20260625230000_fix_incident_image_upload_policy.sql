-- Allow incident photo uploads for the same public role model used by incidents inserts
DROP POLICY IF EXISTS "Authenticated users can upload incident images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload incident images" ON storage.objects;

CREATE POLICY "Users can upload incident images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'incident-images');
