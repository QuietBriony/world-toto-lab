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
create index if not exists human_scout_reports_round_id_idx on public.human_scout_reports(round_id);
create index if not exists human_scout_reports_match_id_idx on public.human_scout_reports(match_id);
create index if not exists human_scout_reports_user_id_idx on public.human_scout_reports(user_id);
create index if not exists generated_tickets_round_id_idx on public.generated_tickets(round_id);
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

drop trigger if exists set_picks_updated_at on public.picks;
create trigger set_picks_updated_at
before update on public.picks
for each row execute function public.set_updated_at();

drop trigger if exists set_human_scout_reports_updated_at on public.human_scout_reports;
create trigger set_human_scout_reports_updated_at
before update on public.human_scout_reports
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.rounds enable row level security;
alter table public.matches enable row level security;
alter table public.picks enable row level security;
alter table public.human_scout_reports enable row level security;
alter table public.generated_tickets enable row level security;
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

drop policy if exists "anon can read review notes" on public.review_notes;
create policy "anon can read review notes" on public.review_notes for select to anon using (true);
drop policy if exists "anon can insert review notes" on public.review_notes;
create policy "anon can insert review notes" on public.review_notes for insert to anon with check (true);
drop policy if exists "anon can update review notes" on public.review_notes;
create policy "anon can update review notes" on public.review_notes for update to anon using (true) with check (true);
drop policy if exists "anon can delete review notes" on public.review_notes;
create policy "anon can delete review notes" on public.review_notes for delete to anon using (true);
