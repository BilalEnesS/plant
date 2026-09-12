/**
 * Cost model — unit economics per identification.
 *
 * In a consumer scanner app the unit cost IS a product decision: at millions
 * of scans a month, a fraction of a cent per identification sets the margin.
 * That is why the cost axis of this measurement matters as much as accuracy.
 *
 * Prices are public list prices as of 2026-09 (USD / 1M tokens). The EachLabs
 * router reflects the provider's price, and the actual invoice may differ — so
 * these numbers are for ORDER-OF-MAGNITUDE comparison: the RATIO between paths
 * is meaningful, the absolute value is approximate.
 */
export const PRICING = {
  'gemini-2.5-flash': { inPer1M: 0.3, outPer1M: 2.5 },
  'claude-sonnet-4.5': { inPer1M: 3.0, outPer1M: 15.0 },
  // A REASONING model: thinking tokens count toward completion, so the output
  // side is far more expensive than the visible answer (measured: 884-1232
  // completion tokens vs. 278 for Sonnet). TRIED as Tier 2 and rejected — see
  // eval/results-tier2-bakeoff.md. The price line stays for comparison.
  'gemini-2.5-pro': { inPer1M: 1.25, outPer1M: 10.0 },
  // Tier 2 (current). CAUTION: this preview model's list price is unverified;
  // the value here assumes parity with 2.5-flash, so the Tier-2 line in the
  // cost table should be read as a LOWER BOUND. Update once billing is
  // confirmed.
  'gemini-3-flash-preview': { inPer1M: 0.3, outPer1M: 2.5 },
};

/** Pl@ntNet free tier: 500 requests/day, non-commercial use. */
export const PLANTNET_FREE_TIER_PER_DAY = 500;
/**
 * Approximate cost per identification on the paid tier. It is 0 on the free
 * tier, but treating it as zero would misrepresent "what happens at scale" —
 * so the README gives both scenarios.
 */
export const PLANTNET_PAID_PER_CALL = 0.001;

export function llmCost(model, usage) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const inTok = usage.prompt_tokens ?? 0;
  const outTok = usage.completion_tokens ?? 0;
  return (inTok / 1e6) * p.inPer1M + (outTok / 1e6) * p.outPer1M;
}

export function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}
