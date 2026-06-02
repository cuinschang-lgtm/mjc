-- Add external source id mapping columns to albums
-- netease_album_id keeps the numeric album id from NetEase Cloud Music
ALTER TABLE IF EXISTS public.albums
  ADD COLUMN IF NOT EXISTS netease_album_id TEXT;

-- Create a partial unique index to prevent duplicates when value is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'uniq_albums_netease_album_id'
    AND    n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX uniq_albums_netease_album_id ON public.albums(netease_album_id) WHERE netease_album_id IS NOT NULL;';
  END IF;
END$$;

-- Optional helper index for lookups (redundant when unique index exists but explicit for clarity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'idx_albums_netease_album_id'
    AND    n.nspname = 'public'
  ) THEN
    EXECUTE 'CREATE INDEX idx_albums_netease_album_id ON public.albums(netease_album_id);';
  END IF;
END$$;

