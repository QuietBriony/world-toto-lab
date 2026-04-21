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
