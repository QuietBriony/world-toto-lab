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

alter table public.round_ev_assumptions enable row level security;
alter table public.candidate_tickets enable row level security;
alter table public.candidate_votes enable row level security;
alter table public.toto_official_rounds enable row level security;
alter table public.toto_official_matches enable row level security;
alter table public.toto_official_round_library enable row level security;
