-- Allow uploading advert images (e.g. via dashboard, scripts, or admin tools)
DROP POLICY IF EXISTS "Admins can upload advert images" ON storage.objects;

CREATE POLICY "Admins can upload advert images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'advert-images');
