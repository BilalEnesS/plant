# Plantie — Measurement Results

Dataset: 36 images, GBIF CC0, expert-verified species names.
Run: 2026-09-10T09:47:39.564Z

| Path | top-1 (binomial) | top-1 (genus) | top-3 | p50 latency | p95 latency | cost/identification |
|---|---|---|---|---|---|---|
| A · Pl@ntNet only | 63.9% | 86.1% | 72.2% | 761ms | 2216ms | $0.00100 |
| B · VLM only | 22.2% | 38.9% | 27.8% | 1577ms | 2471ms | $0.00059 |
| C · hybrid (Tier-1 re-ranks) | 58.3% | 75.0% | 72.2% | 2372ms | 3780ms | $0.00165 |
| D · cascade (Tier-2 adjudicator) | 63.9% | 86.1% | 72.2% | 2630ms | 4950ms | $0.00184 |
| E · conservative hybrid | 63.9% | 83.3% | 72.2% | 2372ms | 3780ms | $0.00165 |
| F · conservative + junk-candidate rescue | 63.9% | 83.3% | 72.2% | 2372ms | 3780ms | $0.00165 |

## Cascade behaviour

- Identifications escalated to Tier-2: **10/36** (27.8%)
- Cases where Tier-2 corrected Tier-1: **2**
- Tier-1 JSON parse failures: **0/36**

Trigger distribution:

- `low-score-but-vlm-confident`: 5
- `vlm-rejected-all-candidates`: 5
