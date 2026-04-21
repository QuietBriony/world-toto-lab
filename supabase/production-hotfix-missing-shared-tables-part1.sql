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
