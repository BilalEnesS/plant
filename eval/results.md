# Plantie — Measurement Results

Dataset: 36 images, GBIF CC0, expert-verified species names.
Report rendered: 2026-09-12T09:04:19.592Z (--replay over cached raw responses, no new API calls)

| Path | top-1 (binomial) | top-1 (genus) | top-3 | p50 latency | p95 latency | cost/identification |
|---|---|---|---|---|---|---|
| A · Pl@ntNet only | 63.9% | 86.1% | 72.2% | 692ms | 1861ms | $0.00100 |
| B · VLM only | 22.2% | 41.7% | 27.8% | 1667ms | 2256ms | $0.00059 |
| C · hybrid (Tier-1 re-ranks) | 52.8% | 66.7% | 72.2% | 3358ms | 5412ms | $0.00208 |
| D · cascade (Tier-2 adjudicator) | 55.6% | 75.0% | 72.2% | 3635ms | 7468ms | $0.00235 |
| E · conservative hybrid | 63.9% | 88.9% | 72.2% | 3358ms | 5412ms | $0.00208 |
| F · conservative + junk-candidate rescue | 63.9% | 88.9% | 72.2% | 3358ms | 5412ms | $0.00208 |

## Cascade behaviour

- Identifications escalated to Tier-2: **9/36** (25.0%)
- Cases where Tier-2 corrected Tier-1: **1**
- Tier-1 JSON parse failures: **0/36**

Trigger distribution:

- `low-score-but-vlm-confident`: 7
- `tier1-says-not-a-plant`: 1
- `no-classifier-candidates`: 1
