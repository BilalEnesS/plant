import type { Candidate, Care, ConfidenceBand, Enrichment, VisualAgreement } from '@/services/types';
import type { Locale } from '@/store/useLocaleStore';

/**
 * The language the enrichment output (common name, care text, toxicity note)
 * is produced in. JSON field names (species_common_tr etc.) are DELIBERATELY
 * unchanged — to avoid touching the DB schema/types; only the CONTENT's
 * language changes. A record is stored in whatever language it was scanned
 * in; if the user switches language later, past records aren't retranslated
 * (like a photo library's history — a deliberate, simple design choice).
 */
function languageName(locale: Locale): string {
  return locale === 'en' ? 'English' : 'Turkish';
}

// --- Phase 5: sticker prompt ---

/**
 * This model does NOT support negative_prompt (verified live — it's absent
 * from the request schema). So the negative is folded into the positive
 * prompt's tail as "Avoid:".
 */
export const STICKER_NEGATIVE_TRAITS =
  'photorealistic, 3d render, blurry, text, watermark, multiple plants, cluttered background, dark, horror';

/**
 * `speciesCommonEn` is optional — enrichment only produces a Turkish common
 * name (per the spec's JSON schema); an English common name isn't requested
 * separately. If absent, this callout sentence is skipped; the image
 * model's real guidance is already stickerTraits (English, botanical
 * details) and speciesLatin (a universal identifier).
 */
export function buildStickerPrompt(speciesLatin: string, stickerTraits: string, speciesCommonEn?: string | null): string {
  const subject = speciesCommonEn
    ? `${speciesLatin}, commonly known as ${speciesCommonEn}`
    : speciesLatin;
  return (
    `Die-cut sticker illustration of ${subject}. ` +
    `Botanical features to preserve: ${stickerTraits}. ` +
    'Style: friendly flat vector cartoon, bold clean outlines, 3 to 4 flat colour fills with ' +
    'simple cel shading, slightly rounded and chunky shapes, cheerful character but ' +
    'botanically recognisable — leaf shape, petal count and growth habit must stay accurate. ' +
    'Composition: single plant, centred, full subject visible, three-quarter view. ' +
    'Finish: thick white die-cut border around the silhouette, flat solid pale background, ' +
    'no drop shadow, no gradient mesh, no text, no watermark, no human hands, no pot unless ' +
    'the species is typically potted. Square 1:1. ' +
    `Avoid: ${STICKER_NEGATIVE_TRAITS}.`
  );
}

export const VLM_SYSTEM_PROMPT =
  'You are a strict JSON API for plant identification cross-validation. ' +
  'Reply with only a single valid JSON object, no markdown fences, no commentary.';

/**
 * `allowOwnGuess`: only passed true when Pl@ntNet's score is very low (<5%,
 * the classifier has effectively failed). In the normal flow we don't let
 * the VLM stray outside the candidates — we don't want it drifting to its
 * own guess when Pl@ntNet is actually right.
 */
export function buildVlmUserPrompt(candidates: Candidate[], allowOwnGuess = false, locale: Locale = 'tr'): string {
  const hasCandidates = candidates.length > 0;
  const list = candidates
    .slice(0, 3)
    .map((c, i) => `${i}: ${c.latin}`)
    .join('\n');

  const ownGuessInstructions = allowOwnGuess
    ? hasCandidates
      ? `\nThese candidates come from a specialist classifier that had VERY LOW confidence (it may be completely wrong — e.g. a cactus/succulent it could not match). If NONE of the candidates plausibly matches the photo, set "best_match_index" to -1 and put your own best guess at the Latin binomial name (based on your own visual knowledge, independent of the list above) in "own_guess_latin". Only do this if you are reasonably confident in your own guess — otherwise pick the closest candidate normally.`
      : `\nThe specialist classifier could not produce ANY candidate for this photo. Set "best_match_index" to -1 and, if you are reasonably confident, put your own best guess at the Latin binomial name in "own_guess_latin" (based on your own visual knowledge). If you are not confident either, set "own_guess_latin" to null.`
    : '';

  return `A classifier proposed these plant species candidates for the attached photo, ranked by confidence:
${hasCandidates ? list : '(no candidates)'}
${ownGuessInstructions}

${responseSchemaBlock(allowOwnGuess, locale)}`;
}

/** Both tiers return the SAME schema — parseStrictJson stays a single validator. */
function responseSchemaBlock(allowOwnGuess: boolean, locale: Locale): string {
  const lang = languageName(locale);
  return `Look at the photo and answer as a single JSON object with exactly these fields:
{
  "is_plant": boolean — false if the photo does not clearly show a plant,
  "best_match_index": number — index (0-based) of the candidate that visually matches the photo best${allowOwnGuess ? ', or -1 (see instructions above)' : ''},
  "own_guess_latin": string or null — only set when best_match_index is -1; your own Latin binomial guess, else null,
  "visual_agreement": "high" | "medium" | "low" — how well the best-matching candidate's typical appearance matches what you see in the photo,
  "species_common_tr": string — common name for the best-matching species (or your own guess), written in ${lang},
  "care": { "water": string, "light": string, "soil": string } — short care tips written in ${lang}, or null if unknown,
  "toxic_to_pets": boolean or null — whether this species is commonly known to be toxic to cats/dogs,
  "toxicity_note": string or null — a short note in ${lang} if toxic, else null,
  "sticker_traits": string — a short ENGLISH description of the distinguishing visible botanical features (leaf shape, flower color/petal count, growth habit) for an illustrator to draw — always English regardless of the language above, this field is never shown to the user
}
Reply with only that JSON object.`;
}

/**
 * The Tier 2 prompt: an INDEPENDENT second look, not an adjudication.
 *
 * Two deliberate design choices, both aimed at making the second pass carry
 * information the first one didn't:
 *
 * 1. **Blind to Tier 1's answer.** The earlier version showed the first
 *    model's species verdict and asked which was right. Once both tiers run
 *    the same model that is actively harmful: the second pass anchors on the
 *    first, its answer correlates with it, and "the two tiers agree" — which
 *    confidence.ts treats as evidence strong enough to raise a band — mostly
 *    measures the anchoring rather than the plant. Withholding the guess is
 *    what makes agreement mean something.
 *
 * 2. **Characters before conclusion.** `observed_characters` is the FIRST
 *    field in the response schema, so the model has to write down what it
 *    can actually see (leaf arrangement, margin, venation, floral structure)
 *    before it names anything. Tier 1 is free to answer by gestalt
 *    recall; forcing Tier 2 down a botanical-key path gives two genuinely
 *    different routes to an answer, which is the property that makes a
 *    two-vote ensemble worth more than one vote taken twice.
 *
 * The classifier's candidates are still shown — Tier 2 must be able to pick
 * one by index — but its scores are withheld too, for the same anchoring reason.
 */
export function buildSecondOpinionPrompt(
  candidates: Candidate[],
  allowOwnGuess = false,
  locale: Locale = 'tr',
): string {
  const list = candidates.length
    ? candidates
        .slice(0, 3)
        .map((c, i) => `${i}: ${c.latin}`)
        .join('\n')
    : '(the specialist classifier returned no candidates at all)';

  return `You are performing an INDEPENDENT second identification of the plant in this photo.

Another system has already examined it. You are deliberately NOT being shown what it concluded: your value here is an independent reading of the image, not agreement with an earlier one.

Work in this order and do not skip step 1:
1. Look at the photo and record the botanical characters you can actually SEE — leaf shape, margin, venation and arrangement (alternate / opposite / whorled / basal rosette); flower symmetry, colour, petal or ray-floret count, inflorescence type; stem, growth habit, any fruit. Describe only what is visible, not what you expect.
2. Only then decide which species those characters point to.

Candidate species proposed by a specialist classifier:
${list}

- If the characters you recorded match one of the candidates, select it with "best_match_index".
- If they clearly do not match any candidate${allowOwnGuess ? ' and point to a species you are confident about' : ''}, set "best_match_index" to -1 and give that species in "own_guess_latin".
- If the characters are not distinctive enough to identify it, set "own_guess_latin" to null and "visual_agreement" to "low". Do not invent a species to seem helpful.
- "visual_agreement" must describe how well your recorded characters fit the species you chose.

Look at the photo and answer as a single JSON object with exactly these fields, in this order:
{
  "observed_characters": string — the visible botanical characters from step 1, written in English, one short clause each,
  "is_plant": boolean — false if the photo does not clearly show a plant,
  "best_match_index": number — index of the candidate your characters support, or -1,
  "own_guess_latin": string or null — your own Latin binomial when best_match_index is -1, else null,
  "visual_agreement": "high" | "medium" | "low",
  "species_common_tr": string — common name for the chosen species, written in ${languageName(locale)},
  "care": { "water": string, "light": string, "soil": string } — short care tips written in ${languageName(locale)}, or null if unknown,
  "toxic_to_pets": boolean or null,
  "toxicity_note": string or null — a short note in ${languageName(locale)} if toxic, else null,
  "sticker_traits": string — a short ENGLISH description of the distinguishing visible features for an illustrator, always English regardless of the language above
}
Reply with only that JSON object.`;
}

// --- Per-plant chat ---

/**
 * The facts the chat is grounded in. Deliberately a plain shape rather than
 * the `Discovery` row: prompt.ts stays dependent only on primitives, so it
 * can be unit-tested and reused without dragging in the DB layer.
 */
export interface ChatGrounding {
  speciesLatin: string;
  speciesCommon: string | null;
  confidenceBand: ConfidenceBand;
  /** The species came from the VLM's own guess — no Pl@ntNet confirmation at all. */
  viaVlmFallback: boolean;
  care: Care | null;
  toxicToPets: boolean | null;
  toxicityNote: string | null;
}

/**
 * System prompt for the per-plant chat.
 *
 * Three deliberate constraints, each with a reason:
 *
 * 1. **Grounded, not open-ended.** The model is given this record's actual
 *    fields and told the conversation is about THIS plant. Without that it
 *    becomes a generic chatbot that happens to live in a plant app.
 *
 * 2. **Confidence is carried into the chat.** The result screen already
 *    refuses to hide uncertainty behind a percentage; it would be
 *    inconsistent for the chat to then answer as if the ID were certain.
 *    A medium/low band (or a VLM-only guess) is stated in the prompt so the
 *    model hedges instead of asserting.
 *
 * 3. **The spec's forbidden features stay forbidden.** "Disease diagnosis"
 *    is on the original spec's excluded list, and an open chat is exactly
 *    where a user would ask for it ("why are the leaves yellow?"). Rather
 *    than dropping the rule because the surface changed, the prompt refuses
 *    to diagnose and redirects to general care checks. Same reasoning for
 *    medical/veterinary advice, where a wrong answer is genuinely harmful.
 */
export function buildChatSystemPrompt(g: ChatGrounding, locale: Locale): string {
  const lang = languageName(locale);
  const name = g.speciesCommon ? `${g.speciesCommon} (${g.speciesLatin})` : g.speciesLatin;

  // States the STRENGTH of the identification, never its provenance. An
  // earlier version said "not confirmed by the specialist classifier", which
  // made the model explain the app's internals to the user — see the rule
  // below and the plan's transparency decision.
  const certainty = g.viaVlmFallback
    ? 'This identification is uncertain. Treat it as a plausible guess rather than a settled fact, and say plainly that you are not certain whenever the answer depends on the species being right.'
    : g.confidenceBand === 'high'
      ? 'This identification is high confidence.'
      : `This identification is ${g.confidenceBand} confidence — do not speak as if the species is certain, and acknowledge the uncertainty when it matters to the answer.`;

  const careBlock = g.care
    ? `Care information already shown to the user for this plant:
- Water: ${g.care.water}
- Light: ${g.care.light}
- Soil: ${g.care.soil}`
    : 'No care information was generated for this plant.';

  const toxicityBlock =
    g.toxicToPets === true
      ? `This species is commonly known to be toxic to cats/dogs.${g.toxicityNote ? ` Note shown to the user: ${g.toxicityNote}` : ''}`
      : g.toxicToPets === false
        ? 'This species is not commonly listed as toxic to cats/dogs.'
        : 'Toxicity to pets is unknown for this record.';

  return `You are a plant care assistant inside a plant identification app. The user photographed a plant, the app identified it, and you are now answering questions about THAT specific plant.

The plant in question: ${name}
${certainty}

${careBlock}

${toxicityBlock}

Rules:
- Answer in ${lang}.
- Keep answers short: 2-4 sentences. This is a phone chat, not an article. Plain conversational text — no markdown headings, no bullet lists, no bold.
- Stay on the subject of this plant and plant care. If asked about something unrelated, say briefly that you can only help with this plant, and offer something you can answer.
- You CANNOT see the user's plant right now and you have no information about its current condition. Never invent details about their specific specimen.
- Do NOT diagnose plant diseases, pests, or infections. If the user describes symptoms (yellowing, spots, wilting, bugs), say you can't diagnose it from a description, then give general care factors worth checking for this species (watering, light, drainage, humidity) and suggest a local nursery or plant expert for a real diagnosis.
- Do NOT give medical or veterinary advice. If a person or animal has eaten or reacted to this plant, tell them to contact a doctor, a vet, or a poison control line right away, and do not estimate severity yourself.
- Never describe how the app works. Do not name or allude to the services, models, APIs, databases or classifiers behind the identification, and never say which of them agreed, disagreed, or failed. If asked how the plant was identified, say only that the app recognised it from the photo and that you don't have details beyond that. You may still say how confident the identification is.
- If you don't know something about this species, say so plainly instead of guessing.`;
}

const VALID_AGREEMENT: VisualAgreement[] = ['high', 'medium', 'low'];

/**
 * response_format:"json_object" is requested but not trusted — the model may
 * add fences or skip a field. Every field is validated by hand; any
 * mismatch returns null. An enrichment failure NEVER drops the
 * identification — the caller reads null as "no care info, but the ID still stands."
 */
export function parseStrictJson(raw: string): Enrichment | null {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;

    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

    if (typeof parsed.is_plant !== 'boolean') return null;
    if (typeof parsed.best_match_index !== 'number') return null;
    if (typeof parsed.visual_agreement !== 'string' || !VALID_AGREEMENT.includes(parsed.visual_agreement as VisualAgreement)) {
      return null;
    }
    if (typeof parsed.sticker_traits !== 'string' || parsed.sticker_traits.length === 0) return null;

    const speciesCommonTr = typeof parsed.species_common_tr === 'string' ? parsed.species_common_tr : '';

    let care = null;
    if (parsed.care && typeof parsed.care === 'object') {
      const c = parsed.care as Record<string, unknown>;
      if (typeof c.water === 'string' && typeof c.light === 'string' && typeof c.soil === 'string') {
        care = { water: c.water, light: c.light, soil: c.soil };
      }
    }

    const toxicToPets = typeof parsed.toxic_to_pets === 'boolean' ? parsed.toxic_to_pets : null;
    const toxicityNote = typeof parsed.toxicity_note === 'string' ? parsed.toxicity_note : null;
    const ownGuessLatin =
      typeof parsed.own_guess_latin === 'string' && parsed.own_guess_latin.length > 0
        ? parsed.own_guess_latin
        : null;

    return {
      isPlant: parsed.is_plant,
      bestMatchIndex: parsed.best_match_index,
      ownGuessLatin,
      visualAgreement: parsed.visual_agreement as VisualAgreement,
      speciesCommonTr,
      care,
      toxicToPets,
      toxicityNote,
      stickerTraits: parsed.sticker_traits,
    };
  } catch {
    return null;
  }
}
