alter table public.user_collections
  alter column personal_rating type numeric(3, 1)
  using personal_rating::numeric;

alter table public.user_collections
  drop constraint if exists user_collections_personal_rating_check;

alter table public.user_collections
  add constraint user_collections_personal_rating_check
  check (personal_rating is null or (personal_rating >= 0 and personal_rating <= 10));

