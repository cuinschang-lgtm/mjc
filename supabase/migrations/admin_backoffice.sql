alter table public.albums
  add column if not exists admin_status text not null default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'albums_admin_status_check'
  ) then
    alter table public.albums
      add constraint albums_admin_status_check
      check (admin_status in ('draft', 'published', 'offline'));
  end if;
end $$;

alter table public.albums
  add column if not exists media_reviews_items jsonb,
  add column if not exists awards_items jsonb,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists updated_by uuid;

create index if not exists idx_albums_admin_status on public.albums(admin_status);
create index if not exists idx_albums_updated_at on public.albums(updated_at desc);

create table if not exists public.album_versions (
  id uuid primary key default extensions.uuid_generate_v4(),
  album_id uuid not null,
  version_no int not null,
  reason text,
  snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists uniq_album_versions_album_version
  on public.album_versions(album_id, version_no);
create index if not exists idx_album_versions_album_created
  on public.album_versions(album_id, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default extensions.uuid_generate_v4(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid,
  version_no int,
  before jsonb,
  after jsonb,
  request_id text,
  ip inet,
  user_agent text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_audit_logs_entity
  on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_actor
  on public.audit_logs(actor_id, created_at desc);

alter table public.album_versions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists album_versions_admin_select on public.album_versions;
drop policy if exists album_versions_admin_insert on public.album_versions;
create policy album_versions_admin_select
  on public.album_versions for select
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));
create policy album_versions_admin_insert
  on public.album_versions for insert
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists audit_logs_admin_select on public.audit_logs;
drop policy if exists audit_logs_admin_insert on public.audit_logs;
create policy audit_logs_admin_select
  on public.audit_logs for select
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));
create policy audit_logs_admin_insert
  on public.audit_logs for insert
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

drop policy if exists albums_update_admin on public.albums;
create policy albums_update_admin
  on public.albums for update
  using (exists (select 1 from public.app_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.app_admins a where a.user_id = auth.uid()));

grant select on public.album_versions to authenticated;
grant select on public.audit_logs to authenticated;
grant all privileges on public.album_versions to authenticated;
grant all privileges on public.audit_logs to authenticated;

grant select on public.albums to anon;
grant select on public.albums to authenticated;

