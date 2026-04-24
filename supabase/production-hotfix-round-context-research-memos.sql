create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table public.rounds add column if not exists competition_type text
  not null default 'world_cup'
  check (competition_type in ('world_cup', 'domestic_toto', 'winner', 'custom'));
alter table public.rounds add column if not exists sport_context text
  not null default 'national_team'
  check (sport_context in ('national_team', 'j_league', 'club', 'other'));
alter table public.rounds add column if not exists primary_use text
  not null default 'friend_game'
  check (primary_use in ('real_round_research', 'practice', 'demo', 'friend_game'));
alter table public.rounds add column if not exists data_profile text
  not null default 'worldcup_rich'
  check (data_profile in ('worldcup_rich', 'domestic_standard', 'manual_light', 'demo'));
alter table public.rounds add column if not exists probability_readiness text
  not null default 'not_ready'
  check (probability_readiness in ('ready', 'partial', 'low_confidence', 'not_ready'));

alter table public.matches add column if not exists recent_form_note text;
alter table public.matches add column if not exists availability_info text;
alter table public.matches add column if not exists conditions_info text;
alter table public.matches add column if not exists home_strength_adjust double precision;
alter table public.matches add column if not exists away_strength_adjust double precision;
alter table public.matches add column if not exists availability_adjust double precision;
alter table public.matches add column if not exists conditions_adjust double precision;
alter table public.matches add column if not exists tactical_adjust double precision;
alter table public.matches add column if not exists motivation_adjust double precision;
alter table public.matches add column if not exists admin_adjust_1 double precision;
alter table public.matches add column if not exists admin_adjust_0 double precision;
alter table public.matches add column if not exists admin_adjust_2 double precision;
alter table public.matches add column if not exists home_advantage_adjust double precision;
alter table public.matches add column if not exists rest_days_adjust double precision;
alter table public.matches add column if not exists travel_adjust double precision;
alter table public.matches add column if not exists league_table_motivation_adjust double precision;
alter table public.matches add column if not exists injury_suspension_adjust double precision;
alter table public.matches add column if not exists rotation_risk_adjust double precision;
alter table public.matches add column if not exists group_standing_motivation_adjust double precision;
alter table public.matches add column if not exists travel_climate_adjust double precision;
alter table public.matches add column if not exists altitude_humidity_adjust double precision;
alter table public.matches add column if not exists squad_depth_adjust double precision;
alter table public.matches add column if not exists tournament_pressure_adjust double precision;

create table if not exists public.research_memos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  team text,
  memo_type text not null check (
    memo_type in (
      'recent_form',
      'injury',
      'suspension',
      'motivation',
      'travel_rest',
      'tactical',
      'weather',
      'odds',
      'news',
      'other'
    )
  ),
  title text not null,
  summary text not null,
  source_url text,
  source_name text,
  source_date date,
  confidence text not null default 'medium' check (
    confidence in ('high', 'medium', 'low')
  ),
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists research_memos_round_id_idx on public.research_memos(round_id);
create index if not exists research_memos_match_id_idx on public.research_memos(match_id);
create index if not exists research_memos_created_by_idx on public.research_memos(created_by);

drop trigger if exists set_research_memos_updated_at on public.research_memos;
create trigger set_research_memos_updated_at
before update on public.research_memos
for each row execute function public.set_updated_at();

alter table public.research_memos enable row level security;

drop policy if exists "anon can read research memos" on public.research_memos;
create policy "anon can read research memos" on public.research_memos for select to anon using (true);
drop policy if exists "anon can insert research memos" on public.research_memos;
create policy "anon can insert research memos" on public.research_memos for insert to anon with check (true);
drop policy if exists "anon can update research memos" on public.research_memos;
create policy "anon can update research memos" on public.research_memos for update to anon using (true) with check (true);
drop policy if exists "anon can delete research memos" on public.research_memos;
create policy "anon can delete research memos" on public.research_memos for delete to anon using (true);

notify pgrst, 'reload schema';
