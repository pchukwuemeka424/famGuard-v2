-- Add optional image URL to incidents
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public bucket for incident report photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-images',
  'incident-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Authenticated users can upload incident images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view incident images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own incident images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own incident images" ON storage.objects;

CREATE POLICY "Users can upload incident images"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'incident-images');

CREATE POLICY "Anyone can view incident images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'incident-images');

CREATE POLICY "Users can update own incident images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'incident-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own incident images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'incident-images' AND auth.uid()::text = (storage.foldername(name))[1]);
