create table if not exists public.kronos_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.kronos_data enable row level security;

grant select, insert, update on public.kronos_data to authenticated;

drop policy if exists "Users can access their own Kronos data"
  on public.kronos_data;

create policy "Users can access their own Kronos data"
  on public.kronos_data
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'kronos_data'
  ) then
    alter publication supabase_realtime add table public.kronos_data;
  end if;
end
$$;
