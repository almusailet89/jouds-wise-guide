# Skill — Zakat Engine

## Trigger
User mentions any of: zakat, zakah, زكاة, nisab, niṣāb, hawl, حول, نصاب,
"how much do I owe", "annual purification".

## Purpose
Walk the user through computing zakat across their portfolio (cash, gold,
silver, stocks, crypto, business inventory) using the consensus rule
**2.5% on wealth held for one lunar year above niṣāb**.

## Reference values (refresh annually — store in DB later, not in skill)
- Niṣāb of gold:   85 g of 24K gold (silver standard available on request)
- Niṣāb of silver: 595 g
- Effective niṣāb in SAR: compute live from gold/silver price; never hardcode.
- Rate: 2.5%

## Conversation flow
1. Confirm the user's intent — are we computing for this Hijri year?
2. Ask for current portfolio snapshot — call `get_portfolio_snapshot` tool.
3. For each asset class, ask whether it has been held >= 1 lunar year (hawl).
4. Aggregate eligible wealth in SAR.
5. If aggregate < niṣāb → no zakat due this year. Explain why warmly.
6. If aggregate ≥ niṣāb → multiply by 2.5%. Call `calculate_zakat` tool to
   confirm the figure with the canonical implementation, never compute in-prompt.
7. End with: a) the SAR figure, b) a recommended payment window
   (before next Ramadan is common), c) "Allahu a'lam".

## Boundaries
- DO NOT pronounce on debated cases (mining gold ownership of partial NFT
  fractional shares, etc.) — say "scholars differ; consult your shaykh".
- DO NOT mention specific eligible recipients unless asked.
- DO NOT collect or store the actual figure in memory without explicit consent.
