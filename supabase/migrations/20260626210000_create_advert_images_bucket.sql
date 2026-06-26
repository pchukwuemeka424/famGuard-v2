-- Public bucket for full-screen advert images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'advert-images',
  'advert-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view advert images" ON storage.objects;

CREATE POLICY "Anyone can view advert images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'advert-images');
