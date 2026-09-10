# Plantie — Ölçüm Sonuçları

Veri seti: 36 görsel, GBIF CC0, uzman-doğrulamalı tür adları.
Koşu: 2026-09-10T15:58:55.579Z

| Yol | top-1 (binomial) | top-1 (cins) | top-3 | p50 gecikme | p95 gecikme | maliyet/tanımlama |
|---|---|---|---|---|---|---|
| A · yalnız Pl@ntNet | 63.9% | 86.1% | 72.2% | 692ms | 1861ms | $0.00100 |
| B · yalnız VLM | 22.2% | 41.7% | 27.8% | 1667ms | 2256ms | $0.00059 |
| C · hibrit (Tier-1) | 52.8% | 66.7% | 72.2% | 3358ms | 5412ms | $0.00208 |
| D · kademeli (Tier-2 hakemli) | 55.6% | 75.0% | 72.2% | 3635ms | 7468ms | $0.00235 |
| E · muhafazakâr hibrit | 63.9% | 88.9% | 72.2% | 3358ms | 5412ms | $0.00208 |
| F · muhafazakâr + çöp-aday kurtarma | 63.9% | 88.9% | 72.2% | 3358ms | 5412ms | $0.00208 |

## Kademeleme davranışı

- Tier-2'ye yükselen tanımlama: **9/36** (25.0%)
- Tier-2'nin Tier-1'in hatasını düzelttiği vaka: **1**
- Tier-1 JSON parse hatası: **0/36**

Tetikleyici dağılımı:

- `low-score-but-vlm-confident`: 7
- `tier1-says-not-a-plant`: 1
- `no-classifier-candidates`: 1
