
CREATE POLICY "shared read scontrini" ON storage.objects FOR SELECT USING (bucket_id = 'scontrini');
CREATE POLICY "shared insert scontrini" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'scontrini');
CREATE POLICY "shared update scontrini" ON storage.objects FOR UPDATE USING (bucket_id = 'scontrini') WITH CHECK (bucket_id = 'scontrini');
CREATE POLICY "shared delete scontrini" ON storage.objects FOR DELETE USING (bucket_id = 'scontrini');
