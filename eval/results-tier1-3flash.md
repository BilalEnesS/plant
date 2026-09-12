# Plantie — Measurement Results

Dataset: 36 images, GBIF CC0, expert-verified species names.
Run: 2026-09-10T15:40:37.842Z

| Path | top-1 (binomial) | top-1 (genus) | top-3 | p50 latency | p95 latency | cost/identification |
|---|---|---|---|---|---|---|
| A · Pl@ntNet only | 63.9% | 86.1% | 72.2% | 710ms | 1648ms | $0.00100 |
| B · VLM only | 47.2% | 75.0% | 58.3% | 2415ms | 12393ms | $0.00050 |
| C · hybrid (Tier-1 re-ranks) | 66.7% | 83.3% | 72.2% | 3214ms | 13328ms | $0.00154 |
| D · cascade (Tier-2 adjudicator) | 66.7% | 83.3% | 72.2% | 3365ms | 16533ms | $0.00165 |
| E · conservative hybrid | 63.9% | 86.1% | 72.2% | 3214ms | 13328ms | $0.00154 |
| F · conservative + junk-candidate rescue | 63.9% | 86.1% | 72.2% | 3214ms | 13328ms | $0.00154 |

## Cascade behaviour

- Identifications escalated to Tier-2: **7/36** (19.4%)
- Cases where Tier-2 corrected Tier-1: **0**
- Tier-1 JSON parse failures: **0/36**

Trigger distribution:

- `low-score-but-vlm-confident`: 5
- `vlm-rejected-all-candidates`: 2
