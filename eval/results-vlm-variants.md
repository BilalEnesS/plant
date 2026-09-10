# Yalnız-VLM varyantları — AI-first yaklaşım ne kadar iyi olabilir?

Veri seti: 36 görsel (ana koşuyla aynı). Pl@ntNet kullanılmadı.

| Varyant | top-1 | cins | top-3 | "bilmiyorum" | p50 | maliyet |
|---|---|---|---|---|---|---|
| Flash + düz prompt | 19.4% | 38.9% | 25.0% | 30.6% | 1638ms | $0.00058 |
| Sonnet 4.5 + düz prompt | 19.4% | 27.8% | 19.4% | 8.3% | 3009ms | $0.00294 |
| Sonnet 4.5 + akıl yürütme | 13.9% | 16.7% | 22.2% | 33.3% | 5788ms | $0.00551 |
| Flash + akıl yürütme | 22.2% | 36.1% | 27.8% | 30.6% | 2550ms | $0.00095 |
