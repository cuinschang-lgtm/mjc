-- Albums: editable fields
alter table public.albums
  add column if not exists description text,
  add column if not exists genres text[],
  add column if not exists gallery_urls text[];

-- Profiles: public display name/avatar for reviews
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

create policy "profiles_select_all"
  on public.profiles for select
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin list: used for album editing permissions
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.app_admins enable row level security;

create policy "app_admins_select_own"
  on public.app_admins for select
  using (auth.uid() = user_id);

-- Allow admins to update albums
create policy "albums_update_admin"
  on public.albums for update
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

-- Album reviews
create table if not exists public.album_reviews (
  id uuid default extensions.uuid_generate_v4() primary key,
  album_id uuid references public.albums(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  score numeric(3, 1) not null check (score >= 1 and score <= 10),
  has_listened boolean not null default true,
  content text not null,
  image_urls text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

create index if not exists idx_album_reviews_album_created
  on public.album_reviews (album_id, created_at desc);

create index if not exists idx_album_reviews_user
  on public.album_reviews (user_id, created_at desc);

alter table public.album_reviews enable row level security;

create policy "album_reviews_select_public"
  on public.album_reviews for select
  using (deleted_at is null);

create policy "album_reviews_insert_own"
  on public.album_reviews for insert
  with check (auth.uid() = user_id);

create policy "album_reviews_update_own"
  on public.album_reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Replies (up to 2 levels)
create table if not exists public.review_replies (
  id uuid default extensions.uuid_generate_v4() primary key,
  review_id uuid references public.album_reviews(id) on delete cascade not null,
  parent_reply_id uuid references public.review_replies(id) on delete cascade,
  depth integer not null check (depth in (1, 2)),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

create index if not exists idx_review_replies_review_created
  on public.review_replies (review_id, created_at asc);

alter table public.review_replies enable row level security;

create policy "review_replies_select_public"
  on public.review_replies for select
  using (deleted_at is null);

create policy "review_replies_insert_own"
  on public.review_replies for insert
  with check (auth.uid() = user_id);

create policy "review_replies_update_own"
  on public.review_replies for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Likes for reviews and replies (exactly one target)
create table if not exists public.review_likes (
  id uuid default extensions.uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  review_id uuid references public.album_reviews(id) on delete cascade,
  reply_id uuid references public.review_replies(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  check (
    (review_id is not null and reply_id is null)
    or (review_id is null and reply_id is not null)
  )
);

create unique index if not exists uq_review_likes_user_review
  on public.review_likes (user_id, review_id)
  where review_id is not null;

create unique index if not exists uq_review_likes_user_reply
  on public.review_likes (user_id, reply_id)
  where reply_id is not null;

create index if not exists idx_review_likes_review
  on public.review_likes (review_id);

create index if not exists idx_review_likes_reply
  on public.review_likes (reply_id);

alter table public.review_likes enable row level security;

create policy "review_likes_select_public"
  on public.review_likes for select
  using (true);

create policy "review_likes_insert_own"
  on public.review_likes for insert
  with check (auth.uid() = user_id);

create policy "review_likes_delete_own"
  on public.review_likes for delete
  using (auth.uid() = user_id);

