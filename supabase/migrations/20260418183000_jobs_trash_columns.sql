alter table public.jobs
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null;

create index if not exists jobs_deleted_at_idx
  on public.jobs (deleted_at);
