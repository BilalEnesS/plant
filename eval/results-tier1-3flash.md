# Plantie — Ölçüm Sonuçları

Veri seti: 36 görsel, GBIF CC0, uzman-doğrulamalı tür adları.
Koşu: 2026-09-10T15:40:37.842Z

| Yol | top-1 (binomial) | top-1 (cins) | top-3 | p50 gecikme | p95 gecikme | maliyet/tanımlama |
|---|---|---|---|---|---|---|
| A · yalnız Pl@ntNet | 63.9% | 86.1% | 72.2% | 710ms | 1648ms | $0.00100 |
| B · yalnız VLM | 47.2% | 75.0% | 58.3% | 2415ms | 12393ms | $0.00050 |
| C · hibrit (Tier-1) | 66.7% | 83.3% | 72.2% | 3214ms | 13328ms | $0.00154 |
| D · kademeli (Tier-2 hakemli) | 66.7% | 83.3% | 72.2% | 3365ms | 16533ms | $0.00165 |
| E · muhafazakâr hibrit | 63.9% | 86.1% | 72.2% | 3214ms | 13328ms | $0.00154 |
| F · muhafazakâr + çöp-aday kurtarma | 63.9% | 86.1% | 72.2% | 3214ms | 13328ms | $0.00154 |

## Kademeleme davranışı

- Tier-2'ye yükselen tanımlama: **7/36** (19.4%)
- Tier-2'nin Tier-1'in hatasını düzelttiği vaka: **0**
- Tier-1 JSON parse hatası: **0/36**

Tetikleyici dağılımı:

- `low-score-but-vlm-confident`: 5
- `vlm-rejected-all-candidates`: 2
