# World Cup Toto Operating System

This document keeps the user instructions, Hazi comments, model logic, and
postmortem loop in one place. The goal is not to claim profitable betting. The
goal is to make each assumption visible, testable, and easy to improve after
results are known.

## Current State

The stack is usable, but the optimization layer is still early.

- Clean enough: UI, PDF, CSV, official vote shares, sales snapshots, W杯 context,
  1st/2nd/3rd EV, and portfolio rows are connected.
- Not clean enough yet: Hazi voice memo distillation, external odds, Elo/goal
  model inputs, and enough historical rounds for statistical weight fitting are
  not connected.
- The immediate best next step is backtesting: every closed round should replay
  the public favorite, the at-the-time generated sheet, and the current strategy
  under one evaluator.

## Instruction Taxonomy

| Area | Operating rule | Status |
| --- | --- | --- |
| Plain answer first | Show one-unit cost, budget, possible return, and whether expected return exceeds spend before method detail. | Implemented |
| Deadline snapshot | Prefer official vote/sales data near the sales deadline. Do not rely on early vote shares for final purchase advice. | Implemented |
| Model vs public split | Treat `p_model` as true-result probability and `p_public` as crowd share that drives payout dilution. | Implemented |
| W杯 context | Explicitly model neutral venue, country-name bias, group situation, draw-ok incentives, and rotation risk. | Implemented |
| Prize tiers | Include 1st, 2nd, and 3rd expected return. Track second-prize coverage separately from first-prize hit probability. | Implemented |
| Backtest loop | Re-score closed rounds using public favorite, past PDFs, and current logic. | Partial |
| Hazi distillation | Convert voice notes into reason tags, factor weights, and confidence adjustments. | Next |

## Backtest Contract

Each closed round should store enough data to answer:

1. What was the actual result signature?
2. What was the public favorite signature at the relevant snapshot?
3. Which portfolio was visible to the user before sales closed?
4. How many units did it cost?
5. How many misses did each row have?
6. Did it hit 1st, 2nd, or 3rd?
7. What was the realized return?
8. Which logic tags were responsible for the wins and misses?

Current built-in backtests:

- Round 1634: public favorite missed by 9. The previous positive-EV PDF rows
  also missed the prize zone; best row was 3 misses.
- Round 1635: public favorite missed by 2 and would have hit 3rd prize.

Candidate-universe backtests:

- Public favorite means one line only: the highest official vote outcome in
  each match.
- Phase-aware means a W杯-context candidate set: matchday 1 leaves more draw
  and upset room; matchday 2 stays more favorite-led but keeps draw risk in
  strong-favorite and mid-popularity matches.
- Round 1634 phase-aware contained the actual result, but full coverage required
  139,968 lines / 13,996,800 yen. This is a candidate-generation success, not a
  purchase recommendation.
- Round 1635 phase-aware contained the actual result with 2,048 lines / 204,800
  yen. This is close enough to make the next optimizer useful: rank the universe
  into a 10,000-20,000 yen portfolio and maximize 2nd/3rd-prize coverage.

## Optimization Direction

The target is a constrained portfolio optimizer, not a single pick predictor.

- Objective: maximize expected return from 1st/2nd/3rd tiers.
- Constraints: fixed budget, one unit per broad coverage row, hot rows capped at
  two units, no automated purchase or settlement.
- Secondary objective: increase distance-1 and distance-2 coverage inside the
  declared candidate universe.
- Calibration target: reduce miss reasons by tag, not just improve aggregate
  accuracy.
- Cape Verde rule: when pre-match draw probability is 20% or higher, keep draw
  in the recommendation universe even if the favorite is above 70%. The 1636
  Uruguay vs Cape Verde miss is the regression test for this rule.

## Improvement Loop

1. Add each closed round to a reviewed backtest fixture.
2. Replay the strategy that was actually visible at purchase time.
3. Replay the latest logic against the same historical snapshot.
4. Compare public favorite, old strategy, and current strategy.
5. Assign miss tags: favorite overconfidence, draw underweight, rotation miss,
   group-condition miss, low-information upset, or data freshness miss.
6. Adjust factor weights only when multiple rounds support the change.

## Guardrails

- Do not label proxy EV as guaranteed profit.
- Do not hide buy rows in this app; visibility is required for discussion.
- Do not automate login, purchase, payment, settlement, or credential handling.
- Keep latest PDF/CSV mutable, but keep versioned PDF/CSV immutable for review.
