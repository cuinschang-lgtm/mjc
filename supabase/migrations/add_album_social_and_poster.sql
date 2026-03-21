CREATE TABLE IF NOT EXISTS public.album_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_album_ratings_album_user
ON public.album_ratings (album_id, user_id);

CREATE INDEX IF NOT EXISTS idx_album_ratings_user
ON public.album_ratings (user_id);

CREATE TABLE IF NOT EXISTS public.album_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  like_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_album_reviews_album_user
ON public.album_reviews (album_id, user_id);

CREATE INDEX IF NOT EXISTS idx_album_reviews_album
ON public.album_reviews (album_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.album_review_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_album_review_likes_review_user
ON public.album_review_likes (review_id, user_id);

CREATE INDEX IF NOT EXISTS idx_album_review_likes_review
ON public.album_review_likes (review_id);

CREATE TABLE IF NOT EXISTS public.album_review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_album_review_replies_review
ON public.album_review_replies (review_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.posters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating NUMERIC NOT NULL,
  review_excerpt TEXT,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posters_user
ON public.posters (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.album_content_overrides (
  album_id UUID PRIMARY KEY,
  artist_bio TEXT,
  creation_background TEXT,
  media_reviews TEXT,
  awards TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_album_ratings_set_updated_at'
  ) THEN
    CREATE TRIGGER tr_album_ratings_set_updated_at
    BEFORE UPDATE ON public.album_ratings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_album_reviews_set_updated_at'
  ) THEN
    CREATE TRIGGER tr_album_reviews_set_updated_at
    BEFORE UPDATE ON public.album_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.album_review_likes_apply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.album_reviews SET like_count = like_count + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.album_reviews SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.album_review_replies_apply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.album_reviews SET reply_count = reply_count + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE public.album_reviews SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_album_review_likes_apply'
  ) THEN
    CREATE TRIGGER tr_album_review_likes_apply
    AFTER INSERT OR DELETE ON public.album_review_likes
    FOR EACH ROW
    EXECUTE FUNCTION public.album_review_likes_apply();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_album_review_replies_apply'
  ) THEN
    CREATE TRIGGER tr_album_review_replies_apply
    AFTER INSERT OR DELETE ON public.album_review_replies
    FOR EACH ROW
    EXECUTE FUNCTION public.album_review_replies_apply();
  END IF;
END$$;

ALTER TABLE public.album_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_review_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_content_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS album_content_overrides_select_all ON public.album_content_overrides;

CREATE POLICY album_content_overrides_select_all ON public.album_content_overrides
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS ratings_select_own ON public.album_ratings;
DROP POLICY IF EXISTS ratings_insert_own ON public.album_ratings;
DROP POLICY IF EXISTS ratings_update_own ON public.album_ratings;

CREATE POLICY ratings_select_own ON public.album_ratings
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY ratings_insert_own ON public.album_ratings
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY ratings_update_own ON public.album_ratings
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS reviews_select_published ON public.album_reviews;
DROP POLICY IF EXISTS reviews_select_own ON public.album_reviews;
DROP POLICY IF EXISTS reviews_insert_own ON public.album_reviews;
DROP POLICY IF EXISTS reviews_update_own ON public.album_reviews;
DROP POLICY IF EXISTS reviews_delete_own ON public.album_reviews;

CREATE POLICY reviews_select_published ON public.album_reviews
FOR SELECT TO anon, authenticated
USING (is_published = TRUE);

CREATE POLICY reviews_select_own ON public.album_reviews
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY reviews_insert_own ON public.album_reviews
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY reviews_update_own ON public.album_reviews
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY reviews_delete_own ON public.album_reviews
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS review_likes_select_own ON public.album_review_likes;
DROP POLICY IF EXISTS review_likes_insert_own ON public.album_review_likes;
DROP POLICY IF EXISTS review_likes_delete_own ON public.album_review_likes;

CREATE POLICY review_likes_select_own ON public.album_review_likes
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY review_likes_insert_own ON public.album_review_likes
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY review_likes_delete_own ON public.album_review_likes
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS review_replies_select_published ON public.album_review_replies;
DROP POLICY IF EXISTS review_replies_select_own ON public.album_review_replies;
DROP POLICY IF EXISTS review_replies_insert_own ON public.album_review_replies;
DROP POLICY IF EXISTS review_replies_delete_own ON public.album_review_replies;

CREATE POLICY review_replies_select_published ON public.album_review_replies
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.album_reviews r
    WHERE r.id = review_id AND r.is_published = TRUE
  )
);

CREATE POLICY review_replies_select_own ON public.album_review_replies
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY review_replies_insert_own ON public.album_review_replies
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY review_replies_delete_own ON public.album_review_replies
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS posters_select_own ON public.posters;
DROP POLICY IF EXISTS posters_insert_own ON public.posters;

CREATE POLICY posters_select_own ON public.posters
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY posters_insert_own ON public.posters
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.album_reviews TO anon;
GRANT SELECT ON public.album_review_replies TO anon;
GRANT SELECT ON public.album_content_overrides TO anon;
GRANT ALL PRIVILEGES ON public.album_ratings TO authenticated;
GRANT ALL PRIVILEGES ON public.album_reviews TO authenticated;
GRANT ALL PRIVILEGES ON public.album_review_likes TO authenticated;
GRANT ALL PRIVILEGES ON public.album_review_replies TO authenticated;
GRANT ALL PRIVILEGES ON public.posters TO authenticated;
GRANT SELECT ON public.album_content_overrides TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', FALSE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS posters_objects_select_own ON storage.objects;
DROP POLICY IF EXISTS posters_objects_insert_own ON storage.objects;

CREATE POLICY posters_objects_select_own ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'posters' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY posters_objects_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'posters' AND auth.uid()::text = (storage.foldername(name))[1]);
