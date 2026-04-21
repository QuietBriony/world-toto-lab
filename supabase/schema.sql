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

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'analyzing', 'locked', 'resulted', 'reviewed')),
  budget_yen integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rounds add column if not exists product_type text
  not null default 'toto13'
  check (product_type in ('toto13', 'mini_toto', 'winner', 'custom'));
alter table public.rounds add column if not exists required_match_count integer;
alter table public.rounds add column if not exists active_match_count integer;
alter table public.rounds add column if not exists round_source text
  not null default 'user_manual'
  check (round_source in ('fixture_master', 'toto_official_manual', 'user_manual', 'demo_sample'));
alter table public.rounds add column if not exists source_note text;
alter table public.rounds add column if not exists outcome_set_json jsonb default '["1","0","2"]'::jsonb;
alter table public.rounds add column if not exists void_handling text
  not null default 'manual'
  check (void_handling in ('manual', 'all_outcomes_valid', 'exclude_from_combo', 'keep_as_pending'));

create table if not exists public.fixture_master (
  id uuid primary key default gen_random_uuid(),
  competition text not null,
  source text not null check (
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
  home_team text not null,
  away_team text not null,
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

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_no integer not null,
  home_team text not null,
  away_team text not null,
  kickoff_time timestamptz,
  venue text,
  stage text,
  official_vote_1 double precision,
  official_vote_0 double precision,
  official_vote_2 double precision,
  market_prob_1 double precision,
  market_prob_0 double precision,
  market_prob_2 double precision,
  model_prob_1 double precision,
  model_prob_0 double precision,
  model_prob_2 double precision,
  consensus_f double precision,
  consensus_d double precision,
  consensus_call text,
  disagreement_score double precision,
  exception_count integer,
  confidence double precision,
  category text check (category in ('fixed', 'contrarian', 'draw_candidate', 'info_wait', 'pass')),
  recommended_outcomes text,
  tactical_note text,
  injury_note text,
  motivation_note text,
  admin_note text,
  actual_result text check (actual_result in ('ONE', 'DRAW', 'TWO')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, match_no)
);

alter table public.matches add column if not exists fixture_master_id uuid references public.fixture_master(id) on delete set null;
alter table public.matches add column if not exists official_match_no integer;

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  pick text not null check (pick in ('ONE', 'DRAW', 'TWO')),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, match_id, user_id)
);

create table if not exists public.human_scout_reports (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  score_strength_form integer not null,
  note_strength_form text,
  score_availability integer not null,
  note_availability text,
  score_conditions integer not null,
  note_conditions text,
  score_tactical_matchup integer not null,
  note_tactical_matchup text,
  score_micro integer not null,
  note_micro text,
  draw_alert integer not null,
  note_draw_alert text,
  direction_score_f integer not null,
  provisional_call text not null check (provisional_call in ('axis_1', 'axis_2', 'draw_axis', 'double', 'triple')),
  exception_flag boolean not null default false,
  exception_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, match_id, user_id)
);

create table if not exists public.generated_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  mode text not null check (mode in ('conservative', 'balanced', 'upset')),
  ticket_json text not null,
  ticket_score double precision,
  estimated_hit_prob double precision,
  contrarian_score double precision,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.round_ev_assumptions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  stake_yen integer not null default 100,
  total_sales_yen bigint,
  return_rate double precision not null default 0.50,
  first_prize_share double precision not null default 0.70,
  carryover_yen bigint not null default 0,
  payout_cap_yen bigint,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id)
);

create table if not exists public.candidate_tickets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  label text not null,
  strategy_type text not null check (
    strategy_type in (
      'orthodox_model',
      'public_favorite',
      'human_consensus',
      'ev_hunter',
      'sleeping_value',
      'draw_alert',
      'upset'
    )
  ),
  picks_json jsonb not null,
  p_model_combo double precision,
  p_public_combo double precision,
  estimated_payout_yen double precision,
  gross_ev_yen double precision,
  ev_multiple double precision,
  ev_percent double precision,
  proxy_score double precision,
  hit_probability double precision,
  public_overlap_score double precision,
  contrarian_count integer not null default 0,
  draw_count integer not null default 0,
  human_alignment_score double precision,
  data_quality text not null check (
    data_quality in (
      'complete',
      'missing_official_vote',
      'missing_model_prob',
      'proxy_only',
      'demo_data'
    )
  ),
  rationale text,
  warning text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, label)
);

create table if not exists public.candidate_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  candidate_ticket_id uuid not null references public.candidate_tickets(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  vote text not null check (vote in ('like', 'maybe', 'pass', 'bought_myself')),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, candidate_ticket_id, user_id)
);

create table if not exists public.toto_official_rounds (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  product_type text not null check (product_type in ('toto13', 'mini_toto', 'winner', 'custom')),
  official_round_name text,
  official_round_number integer,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  result_status text not null default 'unknown' check (
    result_status in ('draft', 'selling', 'closed', 'resulted', 'cancelled', 'unknown')
  ),
  stake_yen integer not null default 100,
  total_sales_yen bigint,
  return_rate double precision not null default 0.50,
  first_prize_share double precision,
  carryover_yen bigint not null default 0,
  payout_cap_yen bigint,
  source_url text,
  source_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id)
);

create table if not exists public.toto_official_matches (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  fixture_master_id uuid references public.fixture_master(id) on delete set null,
  official_match_no integer not null,
  home_team text not null,
  away_team text not null,
  kickoff_time timestamptz,
  venue text,
  stage text,
  official_vote_1 double precision,
  official_vote_0 double precision,
  official_vote_2 double precision,
  actual_result text check (actual_result in ('ONE', 'DRAW', 'TWO')),
  match_status text not null default 'scheduled' check (
    match_status in ('scheduled', 'played', 'cancelled', 'postponed', 'void', 'unknown')
  ),
  source_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (round_id, official_match_no)
);

create table if not exists public.toto_official_round_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  product_type text not null check (product_type in ('toto13', 'mini_toto', 'winner', 'custom')),
  required_match_count integer,
  outcome_set_json jsonb default '["1","0","2"]'::jsonb,
  source_note text,
  void_handling text not null default 'manual' check (
    void_handling in ('manual', 'all_outcomes_valid', 'exclude_from_combo', 'keep_as_pending')
  ),
  official_round_name text,
  official_round_number integer,
  sales_start_at timestamptz,
  sales_end_at timestamptz,
  result_status text not null default 'unknown' check (
    result_status in ('draft', 'selling', 'closed', 'resulted', 'cancelled', 'unknown')
  ),
  stake_yen integer not null default 100,
  total_sales_yen bigint,
  return_rate double precision not null default 0.50,
  first_prize_share double precision,
  carryover_yen bigint not null default 0,
  payout_cap_yen bigint,
  source_url text,
  source_text text,
  matches_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.review_notes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists matches_round_id_idx on public.matches(round_id);
create index if not exists picks_round_id_idx on public.picks(round_id);
create index if not exists picks_match_id_idx on public.picks(match_id);
create index if not exists picks_user_id_idx on public.picks(user_id);
create index if not exists fixture_master_competition_idx on public.fixture_master(competition);
create index if not exists fixture_master_match_date_idx on public.fixture_master(match_date);
create index if not exists human_scout_reports_round_id_idx on public.human_scout_reports(round_id);
create index if not exists human_scout_reports_match_id_idx on public.human_scout_reports(match_id);
create index if not exists human_scout_reports_user_id_idx on public.human_scout_reports(user_id);
create index if not exists generated_tickets_round_id_idx on public.generated_tickets(round_id);
create index if not exists round_ev_assumptions_round_id_idx on public.round_ev_assumptions(round_id);
create index if not exists candidate_tickets_round_id_idx on public.candidate_tickets(round_id);
create index if not exists candidate_votes_round_id_idx on public.candidate_votes(round_id);
create index if not exists candidate_votes_candidate_ticket_id_idx on public.candidate_votes(candidate_ticket_id);
create index if not exists candidate_votes_user_id_idx on public.candidate_votes(user_id);
create index if not exists toto_official_rounds_round_id_idx on public.toto_official_rounds(round_id);
create index if not exists toto_official_matches_round_id_idx on public.toto_official_matches(round_id);
create index if not exists toto_official_matches_match_id_idx on public.toto_official_matches(match_id);
create index if not exists toto_official_matches_fixture_master_id_idx on public.toto_official_matches(fixture_master_id);
create index if not exists toto_official_round_library_round_number_idx on public.toto_official_round_library(official_round_number);
create index if not exists toto_official_round_library_created_at_idx on public.toto_official_round_library(created_at desc);
create index if not exists review_notes_round_id_idx on public.review_notes(round_id);

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_rounds_updated_at on public.rounds;
create trigger set_rounds_updated_at
before update on public.rounds
for each row execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_fixture_master_updated_at on public.fixture_master;
create trigger set_fixture_master_updated_at
before update on public.fixture_master
for each row execute function public.set_updated_at();

drop trigger if exists set_picks_updated_at on public.picks;
create trigger set_picks_updated_at
before update on public.picks
for each row execute function public.set_updated_at();

drop trigger if exists set_human_scout_reports_updated_at on public.human_scout_reports;
create trigger set_human_scout_reports_updated_at
before update on public.human_scout_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_round_ev_assumptions_updated_at on public.round_ev_assumptions;
create trigger set_round_ev_assumptions_updated_at
before update on public.round_ev_assumptions
for each row execute function public.set_updated_at();

drop trigger if exists set_candidate_tickets_updated_at on public.candidate_tickets;
create trigger set_candidate_tickets_updated_at
before update on public.candidate_tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_candidate_votes_updated_at on public.candidate_votes;
create trigger set_candidate_votes_updated_at
before update on public.candidate_votes
for each row execute function public.set_updated_at();

drop trigger if exists set_toto_official_rounds_updated_at on public.toto_official_rounds;
create trigger set_toto_official_rounds_updated_at
before update on public.toto_official_rounds
for each row execute function public.set_updated_at();

drop trigger if exists set_toto_official_matches_updated_at on public.toto_official_matches;
create trigger set_toto_official_matches_updated_at
before update on public.toto_official_matches
for each row execute function public.set_updated_at();

drop trigger if exists set_toto_official_round_library_updated_at on public.toto_official_round_library;
create trigger set_toto_official_round_library_updated_at
before update on public.toto_official_round_library
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.rounds enable row level security;
alter table public.fixture_master enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.human_scout_reports enable row level security;
alter table public.generated_tickets enable row level security;
alter table public.round_ev_assumptions enable row level security;
alter table public.candidate_tickets enable row level security;
alter table public.candidate_votes enable row level security;
alter table public.toto_official_rounds enable row level security;
alter table public.toto_official_matches enable row level security;
alter table public.toto_official_round_library enable row level security;
alter table public.review_notes enable row level security;

drop policy if exists "anon can read users" on public.users;
create policy "anon can read users" on public.users for select to anon using (true);
drop policy if exists "anon can insert users" on public.users;
create policy "anon can insert users" on public.users for insert to anon with check (true);
drop policy if exists "anon can update users" on public.users;
create policy "anon can update users" on public.users for update to anon using (true) with check (true);
drop policy if exists "anon can delete users" on public.users;
create policy "anon can delete users" on public.users for delete to anon using (true);

drop policy if exists "anon can read rounds" on public.rounds;
create policy "anon can read rounds" on public.rounds for select to anon using (true);
drop policy if exists "anon can insert rounds" on public.rounds;
create policy "anon can insert rounds" on public.rounds for insert to anon with check (true);
drop policy if exists "anon can update rounds" on public.rounds;
create policy "anon can update rounds" on public.rounds for update to anon using (true) with check (true);
drop policy if exists "anon can delete rounds" on public.rounds;
create policy "anon can delete rounds" on public.rounds for delete to anon using (true);

drop policy if exists "anon can read fixture master" on public.fixture_master;
create policy "anon can read fixture master" on public.fixture_master for select to anon using (true);
drop policy if exists "anon can insert fixture master" on public.fixture_master;
create policy "anon can insert fixture master" on public.fixture_master for insert to anon with check (true);
drop policy if exists "anon can update fixture master" on public.fixture_master;
create policy "anon can update fixture master" on public.fixture_master for update to anon using (true) with check (true);
drop policy if exists "anon can delete fixture master" on public.fixture_master;
create policy "anon can delete fixture master" on public.fixture_master for delete to anon using (true);

drop policy if exists "anon can read matches" on public.matches;
create policy "anon can read matches" on public.matches for select to anon using (true);
drop policy if exists "anon can insert matches" on public.matches;
create policy "anon can insert matches" on public.matches for insert to anon with check (true);
drop policy if exists "anon can update matches" on public.matches;
create policy "anon can update matches" on public.matches for update to anon using (true) with check (true);
drop policy if exists "anon can delete matches" on public.matches;
create policy "anon can delete matches" on public.matches for delete to anon using (true);

drop policy if exists "anon can read picks" on public.picks;
create policy "anon can read picks" on public.picks for select to anon using (true);
drop policy if exists "anon can insert picks" on public.picks;
create policy "anon can insert picks" on public.picks for insert to anon with check (true);
drop policy if exists "anon can update picks" on public.picks;
create policy "anon can update picks" on public.picks for update to anon using (true) with check (true);
drop policy if exists "anon can delete picks" on public.picks;
create policy "anon can delete picks" on public.picks for delete to anon using (true);

drop policy if exists "anon can read scout reports" on public.human_scout_reports;
create policy "anon can read scout reports" on public.human_scout_reports for select to anon using (true);
drop policy if exists "anon can insert scout reports" on public.human_scout_reports;
create policy "anon can insert scout reports" on public.human_scout_reports for insert to anon with check (true);
drop policy if exists "anon can update scout reports" on public.human_scout_reports;
create policy "anon can update scout reports" on public.human_scout_reports for update to anon using (true) with check (true);
drop policy if exists "anon can delete scout reports" on public.human_scout_reports;
create policy "anon can delete scout reports" on public.human_scout_reports for delete to anon using (true);

drop policy if exists "anon can read generated tickets" on public.generated_tickets;
create policy "anon can read generated tickets" on public.generated_tickets for select to anon using (true);
drop policy if exists "anon can insert generated tickets" on public.generated_tickets;
create policy "anon can insert generated tickets" on public.generated_tickets for insert to anon with check (true);
drop policy if exists "anon can update generated tickets" on public.generated_tickets;
create policy "anon can update generated tickets" on public.generated_tickets for update to anon using (true) with check (true);
drop policy if exists "anon can delete generated tickets" on public.generated_tickets;
create policy "anon can delete generated tickets" on public.generated_tickets for delete to anon using (true);

drop policy if exists "anon can read round ev assumptions" on public.round_ev_assumptions;
create policy "anon can read round ev assumptions" on public.round_ev_assumptions for select to anon using (true);
drop policy if exists "anon can insert round ev assumptions" on public.round_ev_assumptions;
create policy "anon can insert round ev assumptions" on public.round_ev_assumptions for insert to anon with check (true);
drop policy if exists "anon can update round ev assumptions" on public.round_ev_assumptions;
create policy "anon can update round ev assumptions" on public.round_ev_assumptions for update to anon using (true) with check (true);
drop policy if exists "anon can delete round ev assumptions" on public.round_ev_assumptions;
create policy "anon can delete round ev assumptions" on public.round_ev_assumptions for delete to anon using (true);

drop policy if exists "anon can read candidate tickets" on public.candidate_tickets;
create policy "anon can read candidate tickets" on public.candidate_tickets for select to anon using (true);
drop policy if exists "anon can insert candidate tickets" on public.candidate_tickets;
create policy "anon can insert candidate tickets" on public.candidate_tickets for insert to anon with check (true);
drop policy if exists "anon can update candidate tickets" on public.candidate_tickets;
create policy "anon can update candidate tickets" on public.candidate_tickets for update to anon using (true) with check (true);
drop policy if exists "anon can delete candidate tickets" on public.candidate_tickets;
create policy "anon can delete candidate tickets" on public.candidate_tickets for delete to anon using (true);

drop policy if exists "anon can read candidate votes" on public.candidate_votes;
create policy "anon can read candidate votes" on public.candidate_votes for select to anon using (true);
drop policy if exists "anon can insert candidate votes" on public.candidate_votes;
create policy "anon can insert candidate votes" on public.candidate_votes for insert to anon with check (true);
drop policy if exists "anon can update candidate votes" on public.candidate_votes;
create policy "anon can update candidate votes" on public.candidate_votes for update to anon using (true) with check (true);
drop policy if exists "anon can delete candidate votes" on public.candidate_votes;
create policy "anon can delete candidate votes" on public.candidate_votes for delete to anon using (true);

drop policy if exists "anon can read toto official rounds" on public.toto_official_rounds;
create policy "anon can read toto official rounds" on public.toto_official_rounds for select to anon using (true);
drop policy if exists "anon can insert toto official rounds" on public.toto_official_rounds;
create policy "anon can insert toto official rounds" on public.toto_official_rounds for insert to anon with check (true);
drop policy if exists "anon can update toto official rounds" on public.toto_official_rounds;
create policy "anon can update toto official rounds" on public.toto_official_rounds for update to anon using (true) with check (true);
drop policy if exists "anon can delete toto official rounds" on public.toto_official_rounds;
create policy "anon can delete toto official rounds" on public.toto_official_rounds for delete to anon using (true);

drop policy if exists "anon can read toto official matches" on public.toto_official_matches;
create policy "anon can read toto official matches" on public.toto_official_matches for select to anon using (true);
drop policy if exists "anon can insert toto official matches" on public.toto_official_matches;
create policy "anon can insert toto official matches" on public.toto_official_matches for insert to anon with check (true);
drop policy if exists "anon can update toto official matches" on public.toto_official_matches;
create policy "anon can update toto official matches" on public.toto_official_matches for update to anon using (true) with check (true);
drop policy if exists "anon can delete toto official matches" on public.toto_official_matches;
create policy "anon can delete toto official matches" on public.toto_official_matches for delete to anon using (true);

drop policy if exists "anon can read toto official round library" on public.toto_official_round_library;
create policy "anon can read toto official round library" on public.toto_official_round_library for select to anon using (true);
drop policy if exists "anon can insert toto official round library" on public.toto_official_round_library;
create policy "anon can insert toto official round library" on public.toto_official_round_library for insert to anon with check (true);
drop policy if exists "anon can update toto official round library" on public.toto_official_round_library;
create policy "anon can update toto official round library" on public.toto_official_round_library for update to anon using (true) with check (true);
drop policy if exists "anon can delete toto official round library" on public.toto_official_round_library;
create policy "anon can delete toto official round library" on public.toto_official_round_library for delete to anon using (true);

drop policy if exists "anon can read review notes" on public.review_notes;
create policy "anon can read review notes" on public.review_notes for select to anon using (true);
drop policy if exists "anon can insert review notes" on public.review_notes;
create policy "anon can insert review notes" on public.review_notes for insert to anon with check (true);
drop policy if exists "anon can update review notes" on public.review_notes;
create policy "anon can update review notes" on public.review_notes for update to anon using (true) with check (true);
drop policy if exists "anon can delete review notes" on public.review_notes;
create policy "anon can delete review notes" on public.review_notes for delete to anon using (true);
