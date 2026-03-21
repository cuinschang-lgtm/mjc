-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create albums table
create table public.albums (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  artist text not null,
  cover_url text,
  release_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create reviews_aggregator table
create table public.reviews_aggregator (
  id uuid default uuid_generate_v4() primary key,
  album_id uuid references public.albums(id) on delete cascade not null,
  source_name text not null,
  score numeric(3, 1), -- e.g. 8.5
  expert_review_summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_collections table
create table public.user_collections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  album_id uuid references public.albums(id) on delete cascade not null,
  status text check (status in ('listened', 'want_to_listen')) not null,
  custom_tags text[], -- Array of strings for tags like #2026MustListen
  personal_rating integer check (personal_rating >= 0 and personal_rating <= 10),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, album_id)
);

-- Enable Row Level Security (RLS)
alter table public.albums enable row level security;
alter table public.reviews_aggregator enable row level security;
alter table public.user_collections enable row level security;

-- Policies for albums (Public read, Admin write - simplified to public read for now)
create policy "Allow public read access on albums"
  on public.albums for select
  using (true);

-- Policies for reviews_aggregator (Public read)
create policy "Allow public read access on reviews_aggregator"
  on public.reviews_aggregator for select
  using (true);

-- Policies for user_collections (Users can manage their own collections)
create policy "Users can view their own collections"
  on public.user_collections for select
  using (auth.uid() = user_id);

create policy "Users can insert into their own collections"
  on public.user_collections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own collections"
  on public.user_collections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own collections"
  on public.user_collections for delete
  using (auth.uid() = user_id);
