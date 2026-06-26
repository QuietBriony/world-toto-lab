# Strong Account Watch

World Toto Lab can watch public Polymarket trader signals as a read-only
research input. This is not a copy-trading feature and never connects a wallet,
places orders, signs messages, moves funds, or automates toto purchases.

## Current Scope

- First target: toto / World Cup toto analysis.
- UI: `/market-sources` -> `強アカWatch`.
- Data source: Polymarket public Data API GET requests.
- Local persistence: `world-toto-lab:market-sources:v1` in browser localStorage.
- Default watch list: curated public Polymarket wallets split into
  `sharp cluster`, `contrarian sharp`, `whale / liquidity`, and
  `inverse caution`.
- Hazi/manual input is not part of the current market overlay. The current
  operating read is official toto vote + Polymarket 1X2 + strong-account watch
  + World Cup context.

The first screenshot-derived account remains `blunttedge`,
`0x664ce9fb97ae1bbd538d7381b2f4e92dab16f49c`. It is a suspected match because
the public API shows a Japan vs Sweden `Japan win / No` footprint with about
`$4.1M` cash PnL, matching the biggest-win clue. Treat it as inferred evidence,
not identity verification.

## Default Watch Roles

- `sharp cluster`: wallets such as `mintblade`, `GRIMDRIP`, and `endlessFate`.
  If several agree with the market against a public favorite, promote that gap.
- `contrarian sharp`: wallets such as `fishalive`, `frostrizz`, `blunttedge`,
  and `BAREFLUX`. Use them to decide whether famous-team No/draw deserves a
  hedge.
- `whale / liquidity`: wallets such as `swisstony` and `BreakTheBank`. Use them
  for market-depth context, not direct picks.
- `inverse caution`: high-PnL or high-volume accounts with mixed or poor
  same-sport evidence. Keep as a warning layer only.

## How To Use In Toto

Use trader signals only as a discussion layer on top of:

- official toto vote share,
- Polymarket 1X2 price history,
- market/source disagreement,
- World Cup context such as group situation, draw incentives, and rotation.

Do not copy a trader's market side directly into a toto ticket. Convert it into
labels such as:

- `public bias watch`,
- `market contrarian signal`,
- `large account footprint`,
- `low sample warning`.

Implementation rule:

```text
final read = official vote + Polymarket price gap + strong-account clue + World Cup context
```

Strong-account clues can unlock a hedge or keep a draw/No visible. They should
not overwrite Polymarket market price, and they should not create an automatic
ticket.

## Warnings

`TraderSignal` should show warnings when:

- the account has only a few predictions,
- one market explains most of the profit,
- the signal is stale,
- the match is inferred from public clues rather than verified identity.

These warnings are intentionally conservative. A single large win can be useful
as a clue, but it is not proof of repeatable forecasting edge.
