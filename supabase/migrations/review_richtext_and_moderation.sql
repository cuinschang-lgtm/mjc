alter table public.album_reviews
  add column if not exists title text,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by uuid references auth.users(id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'album_reviews_title_len'
  ) then
    alter table public.album_reviews
      add constraint album_reviews_title_len
      check (title is null or length(title) <= 50);
  end if;
end $$;

drop policy if exists album_reviews_update_admin on public.album_reviews;
create policy album_reviews_update_admin
  on public.album_reviews for update
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

