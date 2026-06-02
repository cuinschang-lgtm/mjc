-- Ensure unique constraint on user_collections to prevent duplicates
ALTER TABLE user_collections DROP CONSTRAINT IF EXISTS user_collections_user_id_album_id_key;
ALTER TABLE user_collections ADD CONSTRAINT user_collections_user_id_album_id_key UNIQUE (user_id, album_id);

-- Ensure RLS Policies are set up correctly for authenticated users
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews_aggregator ENABLE ROW LEVEL SECURITY;

-- Policies for albums
DROP POLICY IF EXISTS "Enable read access for all users" ON albums;
CREATE POLICY "Enable read access for all users" ON albums FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON albums;
CREATE POLICY "Enable insert for authenticated users only" ON albums FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for user_collections
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON user_collections;
CREATE POLICY "Enable read access for users based on user_id" ON user_collections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON user_collections;
CREATE POLICY "Enable insert for users based on user_id" ON user_collections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_collections;
CREATE POLICY "Enable update for users based on user_id" ON user_collections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_collections;
CREATE POLICY "Enable delete for users based on user_id" ON user_collections FOR DELETE USING (auth.uid() = user_id);

-- Policies for reviews_aggregator
DROP POLICY IF EXISTS "Enable read access for all users" ON reviews_aggregator;
CREATE POLICY "Enable read access for all users" ON reviews_aggregator FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON reviews_aggregator;
CREATE POLICY "Enable insert for authenticated users" ON reviews_aggregator FOR INSERT WITH CHECK (auth.role() = 'authenticated');
