INSERT INTO storage.buckets (id, name, public) VALUES ('vto-temp', 'vto-temp', true);

CREATE POLICY "Allow anon uploads to vto-temp" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'vto-temp');
CREATE POLICY "Allow public reads from vto-temp" ON storage.objects FOR SELECT USING (bucket_id = 'vto-temp');
CREATE POLICY "Allow deletes from vto-temp" ON storage.objects FOR DELETE USING (bucket_id = 'vto-temp');