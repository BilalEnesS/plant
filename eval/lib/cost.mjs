/**
 * Maliyet modeli — tanımlama başına birim ekonomi.
 *
 * Tüketici tarayıcı uygulamasında birim maliyet ürün kararıdır: aylık
 * milyonlarca tarama yapan bir üründe tanımlama başına birkaç kuruş,
 * doğrudan marjı belirler. Bu yüzden ölçümün maliyet ayağı doğruluk kadar
 * önemli.
 *
 * Fiyatlar 2026-09 itibarıyla halka açık liste fiyatları (USD / 1M token).
 * EachLabs router sağlayıcı fiyatını yansıtıyor; kesin fatura farklı olabilir,
 * bu yüzden rakamlar MERTEBE karşılaştırması için — yollar arası ORAN anlamlı,
 * mutlak değer yaklaşık.
 */
export const PRICING = {
  'gemini-2.5-flash': { inPer1M: 0.3, outPer1M: 2.5 },
  'claude-sonnet-4.5': { inPer1M: 3.0, outPer1M: 15.0 },
  // Bir REASONING modeli: düşünme token'ları completion'a sayılıyor, yani
  // çıktı tarafı görünen yanıttan çok daha pahalı (ölçüm: 884-1232 completion
  // token, Sonnet'te 278). Tier 2 olarak DENENDİ ve elendi — bkz.
  // eval/results-tier2-bakeoff.md. Fiyat satırı karşılaştırma için duruyor.
  'gemini-2.5-pro': { inPer1M: 1.25, outPer1M: 10.0 },
  // Tier 2 (mevcut). DİKKAT: bu preview modelin liste fiyatı doğrulanmadı;
  // buradaki değer 2.5-flash'a eşit varsayıldı, yani maliyet tablosundaki
  // Tier-2 kalemi ALT SINIR olarak okunmalı. Faturalandırma teyit edilince
  // güncellenmeli.
  'gemini-3-flash-preview': { inPer1M: 0.3, outPer1M: 2.5 },
};

/** Pl@ntNet ücretsiz katman: 500 istek/gün, ticari olmayan kullanım. */
export const PLANTNET_FREE_TIER_PER_DAY = 500;
/**
 * Ücretli katmanda tanımlama başına yaklaşık maliyet. Ücretsiz katmanda 0,
 * ama "ölçekte ne olur" sorusunun cevabı için sıfır kabul etmek yanıltıcı;
 * bu yüzden README'de her iki senaryo da veriliyor.
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
