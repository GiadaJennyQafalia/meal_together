
CREATE POLICY "ricette-immagini public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ricette-immagini');

CREATE POLICY "ricette-immagini shared insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'ricette-immagini');

CREATE POLICY "ricette-immagini shared update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'ricette-immagini')
  WITH CHECK (bucket_id = 'ricette-immagini');
