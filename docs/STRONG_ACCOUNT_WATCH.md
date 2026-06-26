# Strong Account Watch

World Toto Lab can watch public Polymarket trader signals as a read-only
research input. This is not a copy-trading feature and never connects a wallet,
places orders, signs messages, moves funds, or automates toto purchases.

## Current Scope

- First target: toto / World Cup toto analysis.
- UI: `/market-sources` -> `強アカWatch`.
- Data source: Polymarket public Data API GET requests.
- Local persistence: `world-toto-lab:market-sources:v1` in browser localStorage.
- Initial suspected account: `blunttedge`,
  `0x664ce9fb97ae1bbd538d7381b2f4e92dab16f49c`.

The initial account is a suspected match to the screenshot because the public
API shows a Japan vs Sweden `Japan win / No` footprint with about `$4.1M` cash
PnL, matching the biggest-win clue. Treat it as inferred evidence, not identity
verification.

## How To Use In Toto

Use trader signals only as a discussion layer on top of:

- official toto vote share,
- Polymarket 1X2 price history,
- market/source disagreement,
- human scout notes.

Do not copy a trader's market side directly into a toto ticket. Convert it into
labels such as:

- `public bias watch`,
- `market contrarian signal`,
- `large account footprint`,
- `low sample warning`.

## Warnings

`TraderSignal` should show warnings when:

- the account has only a few predictions,
- one market explains most of the profit,
- the signal is stale,
- the match is inferred from public clues rather than verified identity.

These warnings are intentionally conservative. A single large win can be useful
as a clue, but it is not proof of repeatable forecasting edge.
