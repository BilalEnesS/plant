/**
 * Species-name matching — the most critical and most easily botched part of
 * the measurement.
 *
 * The sources return names in different shapes:
 *   GBIF (ground truth) : "Sonchus oleraceus"
 *   Pl@ntNet            : "Sonchus oleraceus"      (scientificNameWithoutAuthor)
 *   VLM                 : "Sonchus oleraceus L."   or "Sonchus asper" (a near species)
 *
 * So scoring happens at two levels and BOTH are reported:
 *   - binomial : genus + species must match exactly (strict, the headline metric)
 *   - genus    : genus only (partial credit)
 *
 * Reporting the genus level separately is a matter of honesty: saying
 * "Rosa canina" instead of "Rosa gallica" is not completely wrong, but it is
 * not right either — burying that in a single "accuracy" number misleads the
 * reader.
 */

/** "Sonchus oleraceus L." → "sonchus oleraceus" */
export function normalizeLatin(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // author abbreviations, infraspecific ranks, parenthesised notes
    .replace(/\b(subsp|ssp|var|f|cv|sp)\.?\s+\S+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z\s×]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Takes the first two words (genus + species) from a normalised name. */
export function binomialOf(name) {
  const parts = normalizeLatin(name).split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  return parts.slice(0, 2).join(' ');
}

export function genusOf(name) {
  return normalizeLatin(name).split(' ').filter(Boolean)[0] ?? '';
}

export function binomialMatch(predicted, truth) {
  const p = binomialOf(predicted);
  const t = binomialOf(truth);
  return p !== '' && p === t;
}

export function genusMatch(predicted, truth) {
  const p = genusOf(predicted);
  const t = genusOf(truth);
  return p !== '' && p === t;
}

/** Is the truth among the first N predictions (top-k)? */
export function topKMatch(predictions, truth, k, matcher = binomialMatch) {
  return predictions.slice(0, k).some((p) => matcher(p, truth));
}
