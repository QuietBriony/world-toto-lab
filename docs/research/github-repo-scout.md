# GitHub Repo Scout

調査日: 2026-05-05

目的は World Toto Lab を置き換える repo を探すことではなく、計算ロジックやデータ正規化の参考にできる部品を探すことです。今回の変更は調査レポートのみで、コード、依存、Supabase schema、`next.config.ts` は変更しません。

## Summary

- 直接採用できる「日本 toto / BIG / MEGA BIG 用の真EV calculator」は見つかりませんでした。BIG 系は既存の `src/lib/big-carryover/calculator.ts` の方針どおり、公式ルール、等級配分、上限、繰越条件を確認して自前実装するのが安全です。
- サッカー 1X2 確率、Dixon-Coles / Poisson / Elo、bookmaker odds の overround 除去は、MIT / Apache / CC0 の参考 repo がいくつかあります。
- 採用候補はすべて「丸ごと移植」ではなく、数式、API形状、テスト観点を World Toto Lab の型に合わせて再実装する前提です。
- GPL、license なし、purchase automation、bankroll / stake sizing、arbitrage、aggressive return claims 寄りの repo は採用候補から外します。

## Top candidates

| Repo | Category | Last update | Stars | License | Language | Tests | README / data / backtest | World Toto Lab fit | Adoption |
| --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| [martineastwood/penaltyblog](https://github.com/martineastwood/penaltyblog) | soccer model, odds probability | 2026-04-19 | 159 | MIT | Python | Yes: `test/`, `pytest.ini` | Strong README and docs. Covers Poisson, Bivariate Poisson, Dixon-Coles, Elo/Pi ratings, implied probabilities, and data workflows. Mentions sources such as StatsBomb, Opta, Understat, Club Elo. | Best broad reference for 1X2 probability model and overround removal. Useful for model API shape and test cases. | Reference and reimplement selected math in TypeScript. Do not add Python/Cython dependency. |
| [mberk/shin](https://github.com/mberk/shin) | implied probability, overround removal | 2026-03-24 | 99 | MIT | Python / Rust | Yes: `tests/`, `requirements-test.txt` | Focused README with examples and academic references for Shin implied probabilities. No match data dependency. | Best focused reference for converting bookmaker odds into fair probabilities when market odds are available. | Reimplement a small no-vig method first; consider Shin method later with convergence tests. |
| [Torvaney/mezzala](https://github.com/Torvaney/mezzala) | Dixon-Coles, team-strength model | 2021-10-19 | 39 | Apache-2.0 | Python | Not obvious at repo root | README demonstrates adapter-based Dixon-Coles fitting against openfootball JSON. | Useful as a compact reference for data adapter boundaries between raw fixtures and model fitting. | Reference only. Do not import; project is older and Python-oriented. |
| [ghurault/football-prediction](https://github.com/ghurault/football-prediction) | Dixon-Coles in R / Stan | 2023-06-15 | 6 | MIT | R / Stan / HTML | No formal test folder; has validation scripts | README points to public football-data.co.uk data, prior predictive checks, posterior checks, and validation. | Useful for model validation thinking and caution around overfitting. | Reference only; use tests/validation ideas, not code. |
| [openfootball/football.json](https://github.com/openfootball/football.json) | fixture data normalization | 2026-04-29 | 931 | CC0-1.0 | Data | N/A | Season-based football JSON datasets. | Useful reference shape for future fixture import adapters and team name normalization. | Safe data-shape reference. Do not depend on it at runtime. |
| [openfootball/worldcup](https://github.com/openfootball/worldcup) | World Cup fixture/result data | 2026-05-03 | 577 | CC0-1.0 | Data | N/A | Historical World Cup data organized by tournament. | Useful for World Cup mode fixture normalization and historical examples. | Safe data-shape reference. Official FIFA/toto inputs still remain source of truth. |

## Repos to avoid

| Repo | Why not adopt |
| --- | --- |
| [keithchhh/Webscraping-Lottery-Analysis](https://github.com/keithchhh/Webscraping-Lottery-Analysis) | Closest lottery EV notebook found, but license is not declared, tests are absent, and it targets Canadian lotteries rather than BIG / MEGA BIG rules. Use only as a clue that jackpot EV requires tier probabilities, jackpot levels, sales response, and split-prize assumptions. |
| [Torvaney/regista](https://github.com/Torvaney/regista) | Good R package with tests and Dixon-Coles examples, but GPL-3.0. Do not copy code into this repo. Concepts can be independently reimplemented from public math. |
| [roman-smith/oddsapi_ev](https://github.com/roman-smith/oddsapi_ev) | MIT, but old, no tests in root, and tightly coupled to The Odds API plus EV filtering. Useful as a rough checklist for odds fields, not as an implementation source. |
| [HintikkaKimmo/surebet](https://github.com/HintikkaKimmo/surebet) | MIT and tested, but the core scope includes arbitrage and bet-return utilities. Only odds conversion concepts are relevant; arbitrage workflows are out of scope. |
| [jbram22/ev_sports_betting](https://github.com/jbram22/ev_sports_betting) | License not declared, scripts require API key insertion, and Kelly stake sizing is out of scope for World Toto Lab. |
| [darren1998s/Basic-Soccer-Poisson-Model](https://github.com/darren1998s/Basic-Soccer-Poisson-Model) | License not declared, notebook-only, retired/old, and README says the basic Poisson approach should not be used as-is. |
| [huffyhenry/dixon-coles-worldcup](https://github.com/huffyhenry/dixon-coles-worldcup) | License not declared and last updated in 2019. Interesting World Cup-specific reference only. |
| [bparvin12/sports-betting-odds](https://github.com/bparvin12/sports-betting-odds) | Sports odds dashboard, but license is not declared and it targets Next.js 14/Vercel rather than this repo's Next.js 16 static export + GitHub Pages model. |
| [utkarshsingx/picks.](https://github.com/utkarshsingx/picks.) | Betting platform with backend/auth/platform scope and no declared license. Too close to excluded betting-platform behavior. |

## Recommended imports

No direct imports are recommended in this PR.

Future implementation should be split into small PRs:

1. **BIG / MEGA BIG true-EV materials**
   - Keep existing `naiveCarryPressure`, `capAdjustedNaiveCarryPressure`, and `trueEvStatus` separation.
   - Add true-EV only after official product rules are recorded: ticket price, first-prize odds, prize-tier allocation, payout caps, carryover eligibility by tier, void/formation handling, and carryover continuation rules.
   - Use tests to prove that proxy values never become `trueEvStatus = "complete"` without complete official rule data.

2. **Odds implied probability**
   - Start with a tiny TypeScript helper for decimal odds -> implied probability -> normalized no-vig triplet.
   - Add Shin-style method only if market odds become a real input source and convergence behavior can be tested.
   - Keep official toto vote separate from model probability, matching the current architecture.

3. **Soccer 1X2 model**
   - Prototype a small Poisson / Dixon-Coles-inspired model behind `calculateModelProbabilities` rather than adding a new product surface.
   - Treat market probability, Human Scout, and manual adjustments as separate signals.
   - Add calibration/backtest tests before exposing stronger confidence labels.

4. **Fixture and data normalization**
   - Use openfootball JSON shapes as reference examples for adapter tests.
   - Keep FIFA/toto official schedule imports as the authoritative source for real rounds.

## What to build ourselves

- BIG / MEGA BIG true EV should be built from official Japanese product rules, not from a generic lottery notebook.
- Carryover pressure should remain a proxy. It should not include buying advice, profit language, bankroll sizing, or payout sharing between users.
- Candidate ranking should stay inside World Toto Lab's existing data-quality model: strict EV only when assumptions, model probabilities, and official vote are complete; otherwise proxy score.
- Parser work should prefer deterministic TypeScript utilities and fixture-specific tests over adding a broad scraping or API dependency.
- UI work should stay within the current static export and query-param routing model. External dashboards are not strong enough to justify adopting their layouts or dependencies.

## License notes

- MIT and Apache-2.0 repos are acceptable as implementation references, but the preferred approach is independent TypeScript reimplementation with tests.
- CC0 data repos can be used as shape/data references, but real production rounds should still use official toto/FIFA/J.League inputs.
- GPL-3.0 code must not be copied into this repo.
- Repos without a declared license should not be copied, vendored, or used as implementation sources.
- Any future PR that reimplements an algorithm should cite the source repo or public method in docs/tests when it materially influenced the design.

## Next actions

1. Open a small follow-up issue/PR for BIG / MEGA BIG rule capture: define the official-rule fields needed before `trueEvStatus` can ever become `complete`.
2. Add a focused odds-probability helper only after deciding the exact input format for market odds: decimal odds triplet, American odds, or already-normalized probabilities.
3. Choose one soccer-model spike after BIG rule capture: either no-vig market probability import or a minimal Poisson/Dixon-Coles model test harness.
4. Keep every follow-up PR narrow: code + unit tests only for one subsystem, with no schema change unless the required official-rule fields cannot be represented in existing inputs.
