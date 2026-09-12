# VLM-only variants — how good can an AI-first approach get?

Dataset: 36 images (same as the main run). Pl@ntNet was not used.

| Variant | top-1 | genus | top-3 | "don't know" | p50 | cost |
|---|---|---|---|---|---|---|
| Flash + plain prompt | 19.4% | 38.9% | 25.0% | 30.6% | 1638ms | $0.00058 |
| Sonnet 4.5 + plain prompt | 19.4% | 27.8% | 19.4% | 8.3% | 3009ms | $0.00294 |
| Sonnet 4.5 + reasoning | 13.9% | 16.7% | 22.2% | 33.3% | 5788ms | $0.00551 |
| Flash + reasoning | 22.2% | 36.1% | 27.8% | 30.6% | 2550ms | $0.00095 |
