alter table public.takeoff_items
  add column if not exists row_kind text,
  add column if not exists item_kind text,
  add column if not exists parent_id uuid;

update public.takeoff_items
set row_kind = 'item'
where row_kind is null;

update public.takeoff_items
set item_kind = 'cost'
where row_kind = 'item' and item_kind is null;

alter table public.takeoff_items
  alter column row_kind set default 'item';

alter table public.takeoff_items
  alter column row_kind set not null;

create index if not exists takeoff_items_parent_id_idx
  on public.takeoff_items(parent_id);

create index if not exists takeoff_items_job_parent_sort_idx
  on public.takeoff_items(job_id, parent_id, sort_order, created_at);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'takeoff_items_row_kind_check'
  ) then
    alter table public.takeoff_items
      add constraint takeoff_items_row_kind_check
      check (row_kind in ('assembly', 'item'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'takeoff_items_item_kind_check'
  ) then
    alter table public.takeoff_items
      add constraint takeoff_items_item_kind_check
      check (item_kind is null or item_kind in ('scope', 'cost'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'takeoff_items_item_kind_required_check'
  ) then
    alter table public.takeoff_items
      add constraint takeoff_items_item_kind_required_check
      check (
        (row_kind = 'assembly' and item_kind is null)
        or
        (row_kind = 'item' and item_kind is not null)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'takeoff_items_parent_id_fkey'
  ) then
    alter table public.takeoff_items
      add constraint takeoff_items_parent_id_fkey
      foreign key (parent_id)
      references public.takeoff_items(id)
      on delete set null;
  end if;
end
$$;
