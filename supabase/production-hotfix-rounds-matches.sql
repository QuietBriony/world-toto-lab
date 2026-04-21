create table if not exists public.fixture_master (
  id uuid primary key default gen_random_uuid(),
  competition text not null default 'fifa_world_cup_2026',
  source text not null default 'user_manual' check (
    source in (
      'fifa_official_manual',
      'fifa_official_csv',
      'fifa_official_api',
      'user_manual',
      'demo_sample'
    )
  ),
  source_url text,
  source_text text,
  external_fixture_id text,
  match_date date,
  kickoff_time timestamptz,
  timezone text,
  home_team text not null default 'TBD',
  away_team text not null default 'TBD',
  group_name text,
  stage text,
  venue text,
  city text,
  country text,
  data_confidence text not null default 'unknown' check (
    data_confidence in ('official', 'manual_official_source', 'demo', 'unknown')
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists fixture_master_competition_idx on public.fixture_master(competition);
create index if not exists fixture_master_match_date_idx on public.fixture_master(match_date);

drop trigger if exists set_fixture_master_updated_at on public.fixture_master;
create trigger set_fixture_master_updated_at
before update on public.fixture_master
for each row execute function public.set_updated_at();

alter table public.fixture_master enable row level security;

drop policy if exists "anon can read fixture master" on public.fixture_master;
create policy "anon can read fixture master" on public.fixture_master for select to anon using (true);
drop policy if exists "anon can insert fixture master" on public.fixture_master;
create policy "anon can insert fixture master" on public.fixture_master for insert to anon with check (true);
drop policy if exists "anon can update fixture master" on public.fixture_master;
create policy "anon can update fixture master" on public.fixture_master for update to anon using (true) with check (true);
drop policy if exists "anon can delete fixture master" on public.fixture_master;
create policy "anon can delete fixture master" on public.fixture_master for delete to anon using (true);

alter table public.rounds
  add column if not exists product_type text
    not null default 'toto13'
    check (product_type in ('toto13', 'mini_toto', 'winner', 'custom'));

alter table public.rounds
  add column if not exists required_match_count integer;

alter table public.rounds
  add column if not exists active_match_count integer;

alter table public.rounds
  add column if not exists round_source text
    not null default 'user_manual'
    check (round_source in ('fixture_master', 'toto_official_manual', 'user_manual', 'demo_sample'));

alter table public.rounds
  add column if not exists source_note text;

alter table public.rounds
  add column if not exists outcome_set_json jsonb
    default '["1","0","2"]'::jsonb;

alter table public.rounds
  add column if not exists void_handling text
    not null default 'manual'
    check (void_handling in ('manual', 'all_outcomes_valid', 'exclude_from_combo', 'keep_as_pending'));

alter table public.matches
  add column if not exists fixture_master_id uuid references public.fixture_master(id) on delete set null;

alter table public.matches
  add column if not exists official_match_no integer;

update public.rounds
set active_match_count = counts.match_count
from (
  select round_id, count(*)::integer as match_count
  from public.matches
  group by round_id
) as counts
where public.rounds.id = counts.round_id;

update public.rounds
set required_match_count = coalesce(
  required_match_count,
  active_match_count,
  13
);

update public.rounds
set product_type = coalesce(
  product_type,
  case
    when active_match_count = 13 then 'toto13'
    when active_match_count = 5 then 'mini_toto'
    when active_match_count = 1 then 'winner'
    else 'custom'
  end
);

update public.rounds
set round_source = coalesce(round_source, 'user_manual'),
    outcome_set_json = coalesce(outcome_set_json, '["1","0","2"]'::jsonb),
    void_handling = coalesce(void_handling, 'manual');
