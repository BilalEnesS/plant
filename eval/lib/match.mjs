/**
 * Tür adı eşleştirme — ölçümün en kritik ve en kolay yanlış yapılan parçası.
 *
 * Kaynaklar farklı biçimlerde ad döndürüyor:
 *   GBIF (doğru cevap) : "Sonchus oleraceus"
 *   Pl@ntNet           : "Sonchus oleraceus"      (scientificNameWithoutAuthor)
 *   VLM                : "Sonchus oleraceus L."   ya da "Sonchus asper" (yakın tür)
 *
 * Bu yüzden iki seviyede puanlıyoruz ve İKİSİNİ DE raporluyoruz:
 *   - binomial : cins + tür tam eşleşmeli (katı, asıl metrik)
 *   - genus    : yalnızca cins eşleşsin (kısmi kredi)
 *
 * Cins seviyesini ayrı raporlamak dürüstlük meselesi: "Rosa gallica" yerine
 * "Rosa canina" demek tamamen yanlış değil ama doğru da değil; tek bir
 * "accuracy" sayısına gömmek okuyucuyu yanıltır.
 */

/** "Sonchus oleraceus L." → "sonchus oleraceus" */
export function normalizeLatin(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // yazar kısaltmaları, alt tür ekleri, parantezli notlar
    .replace(/\b(subsp|ssp|var|f|cv|sp)\.?\s+\S+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z\s×]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize edilmiş addan ilk iki kelimeyi (cins + tür) alır. */
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

/** Adaylar listesinde ilk N içinde doğru var mı (top-k). */
export function topKMatch(predictions, truth, k, matcher = binomialMatch) {
  return predictions.slice(0, k).some((p) => matcher(p, truth));
}
