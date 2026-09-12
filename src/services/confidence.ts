import type { ConfidenceBand, VisualAgreement } from '@/services/types';

export const BAND_THRESHOLDS = { high: 0.6, medium: 0.25 } as const;

export function bandForScore(score: number): ConfidenceBand {
  if (score >= BAND_THRESHOLDS.high) return 'high';
  if (score >= BAND_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function downgrade(band: ConfidenceBand): ConfidenceBand {
  return band === 'high' ? 'medium' : 'low';
}

export interface ResolveBandInput {
  /** Pl@ntNet's top-1 score. */
  score: number;
  /** Tier 1 (fast VLM) visual-agreement assessment. */
  tier1Agreement: VisualAgreement | null;
  /** Tier 2 (adjudicator) assessment — null if escalation didn't run. */
  tier2Agreement: VisualAgreement | null;
  /** True if Tier 2 ran and agreed with Tier 1 on the SAME species. */
  tiersAgreeOnSpecies: boolean;
}

export interface ResolvedBand {
  band: ConfidenceBand;
  downgraded: boolean;
  upgraded: boolean;
}

/**
 * The architecture's key point: combines Pl@ntNet's score with the VLMs'
 * visual-agreement assessment. The policy is deliberately ASYMMETRIC:
 *
 * - **Downgrade — one model is enough.** If any model says `low`, the band
 *   drops a level and the user is told, even if the score was high. A single
 *   doubt is enough to surface uncertainty; a false positive is expensive.
 *
 * - **Upgrade — needs both models + species agreement.** If Pl@ntNet is in
 *   the low band but BOTH Tier 1 AND Tier 2 say "high" AND they agree on the
 *   same species, the band goes up one level. A single model's confirmation
 *   is NOT enough: Tier 1 saw the candidate list, so its "high" carries a
 *   sycophancy risk and doesn't count as independent evidence. Rationale:
 *   Pl@ntNet's low score often means "torn between similar species," not
 *   "wrong" — two independent visual confirmations offset that.
 *
 * The upgrade ceiling is 'medium', never 'high': claiming top confidence
 * while Pl@ntNet's own confirmation is weak wouldn't be honest.
 *
 * `eval/run.mjs` IMPORTS this module directly rather than copying it, so the
 * measured policy and the shipped policy can never drift apart.
 */
export function resolveBand(input: ResolveBandInput): ResolvedBand {
  const { score, tier1Agreement, tier2Agreement, tiersAgreeOnSpecies } = input;
  const base = bandForScore(score);

  if (tier1Agreement === 'low' || tier2Agreement === 'low') {
    return { band: downgrade(base), downgraded: true, upgraded: false };
  }

  const bothConfirm =
    tier1Agreement === 'high' && tier2Agreement === 'high' && tiersAgreeOnSpecies;

  if (base === 'low' && bothConfirm) {
    return { band: 'medium', downgraded: false, upgraded: true };
  }

  return { band: base, downgraded: false, upgraded: false };
}
