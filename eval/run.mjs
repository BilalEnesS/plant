/**
 * Değerlendirme koşucusu — dört yolu aynı veri üzerinde karşılaştırır.
 *
 *   A  plantnet    Yalnızca uzman sınıflandırıcı (top-1 adayı)
 *   B  vlm         Yalnızca VLM, açık uçlu "bu hangi bitki?" (aday listesi YOK)
 *   C  hybrid      Pl@ntNet + Tier-1 çapraz doğrulama (kademeleme YOK)
 *   D  cascade     C + çelişkide Tier-2 hakem  ← uygulamanın sahaya çıkan hali
 *
 * TASARIM KARARI — görsel başına her API BİR KEZ çağrılır, dört yol aynı ham
 * yanıtlardan türetilir. Bunun üç faydası var: (1) Pl@ntNet'in 500/gün ücretsiz
 * kotasını korur, (2) yollar arası farkın model varyansından değil MİMARİDEN
 * geldiğini garanti eder, (3) koşuyu hızlandırır.
 *
 * Güven politikası uygulamanın GERÇEK confidence.ts dosyasından import edilir
 * (kopyalanmaz) — eval ile sahaya çıkan davranışın zamanla sapması imkânsız.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadEnv,
  callPlantNet,
  chatCompletion,
  parseJsonLoose,
  vlmImageBase64,
  TIER1_MODEL,
  TIER2_MODEL,
} from './lib/clients.mjs';
import { binomialMatch, genusMatch, topKMatch } from './lib/match.mjs';
import { llmCost, percentile, PLANTNET_PAID_PER_CALL } from './lib/cost.mjs';

// Uygulamanın gerçek güven politikası (Node --experimental-strip-types ile).
const confidence = await import(
  new URL('../src/services/confidence.ts', import.meta.url).href
);

/**
 * Uygulamanın GERÇEK prompt'ları. Eskiden bu dosya kendi kopyalarını
 * taşıyordu; bu sessiz bir drift kaynağıydı — app'teki prompt değişince eval
 * hâlâ eskisini ölçüyor ve sayılar sevk edilmeyen bir sistemi anlatıyordu.
 * confidence.ts ile aynı desen: tek kaynak, kopya yok.
 */
const prompts = await import(new URL('../src/services/prompt.ts', import.meta.url).href);

const DIR = import.meta.dirname;

const OPEN_ENDED_PROMPT = `Identify the plant in this photo from your own visual knowledge.
Reply with a single JSON object:
{
  "is_plant": boolean,
  "species_latin": string or null — the Latin binomial; null if you cannot identify it confidently,
  "alternatives": string[] — up to 2 additional plausible Latin binomials, best first
}
Do not invent a species to seem helpful. Reply with only that JSON object.`;

/**
 * pipeline.ts'teki escalationReason'ın AYNADAKİ kopyası — sırası ve
 * tetikleyicileri birebir. Import edilemiyor çünkü pipeline.ts React Native
 * modüllerine bağlı; bu yüzden burada elle senkron tutulan TEK mantık bu.
 * (confidence.ts ve prompt.ts import ediliyor, kopya değil.)
 *
 * Önceki hali sapmıştı: `is_plant === false` durumunda kademelemeyi iptal
 * ediyordu (uygulama ise ikinci görüş İSTİYOR) ve uygulamanın ölçümle
 * kaldırdığı `vlm-rejected-all-candidates` tetikleyicisini hâlâ taşıyordu.
 */
function shouldEscalate(tier1, topScore, hasNoCandidates) {
  if (!tier1) return 'tier1-unparseable';
  if (tier1.is_plant === false) return 'tier1-says-not-a-plant';
  if (hasNoCandidates) return 'no-classifier-candidates';
  if (topScore >= 0.25 && tier1.visual_agreement === 'low') return 'score-vs-agreement-conflict';
  if (confidence.bandForScore(topScore) === 'low' && tier1.visual_agreement === 'high') {
    return 'low-score-but-vlm-confident';
  }
  return null;
}

/** VLM çıktısından nihai tür adını türet (aday seçimi ya da kendi tahmini). */
function resolveSpecies(vlm, candidates) {
  if (!vlm) return candidates[0]?.latin ?? null;
  if (vlm.best_match_index === -1) return vlm.own_guess_latin ?? null;
  const idx = Number.isInteger(vlm.best_match_index) ? vlm.best_match_index : 0;
  return candidates[idx]?.latin ?? candidates[0]?.latin ?? null;
}

/**
 * --replay: API'leri hiç çağırmadan önceki koşunun ham yanıtlarını kullanır.
 * Politika varyantlarını (hangi yol daha iyi?) Pl@ntNet'in 500/gün kotasını
 * yakmadan ve model varyansı işin içine girmeden denemeyi sağlar.
 */
const REPLAY = process.argv.includes('--replay');
const RAW_PATH = path.join(import.meta.dirname, 'results-raw.json');

async function main() {
  if (REPLAY) {
    const raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
    console.log(`--replay: ${raw.length} kayıt diskten okundu (API çağrısı yok)\n`);
    report(raw);
    return;
  }

  const env = await loadEnv();
  const csv = await readFile(path.join(DIR, 'dataset.csv'), 'utf8');
  const rows = csv
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => {
      const cells = line.match(/"([^"]|"")*"/g).map((c) => c.slice(1, -1).replaceAll('""', '"'));
      return { filename: cells[0], truth: cells[1] };
    });

  console.log(`${rows.length} görsel değerlendiriliyor…\n`);

  const records = [];

  for (const [i, row] of rows.entries()) {
    const file = path.join(DIR, 'photos', row.filename);
    const rec = { ...row, errors: [] };

    try {
      const b64 = await vlmImageBase64(file);

      // --- 1) Pl@ntNet (A, C, D ortak kullanır) ---
      const pn = await callPlantNet(env, file);
      rec.plantnet = pn;

      // --- 2) VLM açık uçlu (yalnızca B) ---
      try {
        const r = await chatCompletion(env, {
          model: TIER1_MODEL,
          prompt: OPEN_ENDED_PROMPT,
          imageBase64: b64,
          maxTokens: 400,
        });
        rec.openEnded = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
      } catch (e) {
        rec.errors.push(`openEnded: ${e.message}`);
      }

      // --- 3) VLM çapraz doğrulama Tier-1 (C, D ortak) ---
      // allowOwnGuess, uygulamadaki koşulun aynısı (pipeline.ts): sınıflandırıcı
      // pratikte başarısızsa (aday yok VEYA top-1 < %5) VLM'den bağımsız tahmin istenir.
      const veryLowScore = pn.candidates.length === 0 || (pn.candidates[0]?.score ?? 0) < 0.05;
      try {
        const r = await chatCompletion(env, {
          model: TIER1_MODEL,
          prompt: prompts.buildVlmUserPrompt(pn.candidates, veryLowScore, 'tr'),
          imageBase64: b64,
        });
        rec.tier1 = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
      } catch (e) {
        rec.errors.push(`tier1: ${e.message}`);
      }

      // --- 4) Tier-2 hakem (yalnızca D, yalnızca tetiklenirse) ---
      const topScore = pn.candidates[0]?.score ?? 0;
      const reason = shouldEscalate(rec.tier1?.parsed ?? null, topScore, pn.candidates.length === 0);
      rec.escalationReason = reason;
      if (reason) {
        try {
          const r = await chatCompletion(env, {
            model: TIER2_MODEL,
            // Tier 1'in cevabı BİLEREK geçilmiyor — bağımsız ikinci okuma.
            prompt: prompts.buildSecondOpinionPrompt(pn.candidates, true, 'tr'),
            imageBase64: b64,
            // Mirrors TIER2_MAX_TOKENS in src/api/eachlabs/llm.ts.
            maxTokens: 1200,
          });
          rec.tier2 = { parsed: parseJsonLoose(r.content), usage: r.usage, latencyMs: r.latencyMs };
        } catch (e) {
          rec.errors.push(`tier2: ${e.message}`);
        }
      }

      process.stdout.write(
        `\r  ${i + 1}/${rows.length}  kota:${pn.remaining ?? '?'}  ${reason ? 'kademelendi' : '        '}`,
      );
    } catch (e) {
      rec.errors.push(`fatal: ${e.message}`);
      console.warn(`\n  ${row.filename} atlandı: ${e.message}`);
    }

    records.push(rec);
  }

  console.log('\n');
  // Ham yanıtları sakla — politika varyantları artık --replay ile bedava denenebilir.
  await writeFile(RAW_PATH, JSON.stringify(records, null, 2), 'utf8');
  report(records);
}

function report(records) {
  const paths = {
    A_plantnet: { label: 'A · yalnız Pl@ntNet', preds: [], top3: [], lat: [], cost: [] },
    B_vlm: { label: 'B · yalnız VLM', preds: [], top3: [], lat: [], cost: [] },
    C_hybrid: { label: 'C · hibrit (Tier-1)', preds: [], top3: [], lat: [], cost: [] },
    D_cascade: { label: 'D · kademeli (Tier-2 hakemli)', preds: [], top3: [], lat: [], cost: [] },
    E_conservative: { label: 'E · muhafazakâr hibrit', preds: [], top3: [], lat: [], cost: [] },
    F_rescue: { label: 'F · muhafazakâr + çöp-aday kurtarma', preds: [], top3: [], lat: [], cost: [] },
  };

  let escalated = 0;
  let tier1ParseFail = 0;
  let tier2Rescued = 0;

  for (const r of records) {
    const cands = r.plantnet?.candidates ?? [];
    const pnLat = r.plantnet?.latencyMs ?? 0;
    const pnCost = PLANTNET_PAID_PER_CALL;

    // A — Pl@ntNet top-1
    paths.A_plantnet.preds.push(cands[0]?.latin ?? null);
    paths.A_plantnet.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.A_plantnet.lat.push(pnLat);
    paths.A_plantnet.cost.push(pnCost);

    // B — açık uçlu VLM
    const oe = r.openEnded?.parsed;
    paths.B_vlm.preds.push(oe?.species_latin ?? null);
    paths.B_vlm.top3.push([oe?.species_latin, ...(oe?.alternatives ?? [])].filter(Boolean));
    paths.B_vlm.lat.push(r.openEnded?.latencyMs ?? 0);
    paths.B_vlm.cost.push(llmCost(TIER1_MODEL, r.openEnded?.usage));

    // C — hibrit, Tier-1
    const t1 = r.tier1?.parsed ?? null;
    if (!t1) tier1ParseFail++;
    paths.C_hybrid.preds.push(resolveSpecies(t1, cands));
    paths.C_hybrid.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.C_hybrid.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.C_hybrid.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    // D — kademeli
    const t2 = r.tier2?.parsed ?? null;
    const finalVlm = t2 ?? t1;
    const dPred = resolveSpecies(finalVlm, cands);
    paths.D_cascade.preds.push(dPred);
    paths.D_cascade.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.D_cascade.lat.push(pnLat + (r.tier1?.latencyMs ?? 0) + (r.tier2?.latencyMs ?? 0));
    paths.D_cascade.cost.push(
      pnCost + llmCost(TIER1_MODEL, r.tier1?.usage) + llmCost(TIER2_MODEL, r.tier2?.usage),
    );

    // E — MUHAFAZAKÂR HİBRİT (ölçümün önerdiği tasarım)
    //
    // VLM tür SEÇMEZ. Ölçüm gösterdi ki VLM tek başına %22 doğrulukla tür
    // seviyesinde zayıf; Pl@ntNet'in top-1'ini ezmesine izin vermek doğruluğu
    // düşürüyor (3 doğruyu bozdu, 1 yanlışı düzeltti). Bu yüzden burada:
    //   - Tür ADI her zaman Pl@ntNet top-1'den gelir (aday varsa)
    //   - VLM yalnızca (a) "bu bitki değil" kapısı, (b) güven bandı düşürme,
    //     (c) zenginleştirme (bakım/Türkçe ad/sticker özellikleri) için kullanılır
    //   - Kendi tahminine YALNIZCA Pl@ntNet hiç aday vermediğinde izin verilir
    const finalForE = t2 ?? t1;
    let ePred;
    if (cands.length > 0) {
      ePred = cands[0].latin; // uzman sınıflandırıcıya güven
    } else {
      ePred = finalForE?.own_guess_latin ?? null; // tek dayanak VLM
    }
    // "bitki değil" kapısı korunur — yanlış tür göstermektense hiçbir şey gösterme
    if (finalForE?.is_plant === false) ePred = null;
    paths.E_conservative.preds.push(ePred);
    paths.E_conservative.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.E_conservative.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.E_conservative.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    // F — E + "çöp aday" kurtarma
    //
    // E'nin kör noktası: "aday var mı?" diye soruyor, "adaylar işe yarar mı?"
    // diye değil. Pl@ntNet %0.3 skorla iki alakasız tür döndürdüğünde E bunu
    // "aday var" sayıp VLM'in kendi tahminini ATIYOR — üstelik hattın kendisi
    // o tahmini az önce açıkça İSTEMİŞ oluyor (allowOwnGuess, skor < %5 iken
    // true). İstediğini kabul etmemek tutarsız; cihazda bu, doğru bilinen bir
    // Gazania'nın sonsuz "ikinci fotoğraf" döngüsüne düşmesine yol açtı.
    //
    // F, kurtarmayı yalnızca sınıflandırıcının PRATİKTE BAŞARISIZ olduğu
    // eşikte (top-1 < %5) açar. Bu, D'nin sınırsız ezmesi değil: %5'in
    // üstünde tür adı hâlâ DAİMA Pl@ntNet'ten gelir.
    const RESCUE_BELOW = 0.05;
    const topScore = cands[0]?.score ?? 0;
    let fPred;
    if (cands.length > 0 && topScore >= RESCUE_BELOW) {
      fPred = cands[0].latin;
    } else {
      fPred = finalForE?.own_guess_latin ?? cands[0]?.latin ?? null;
    }
    if (finalForE?.is_plant === false) fPred = null;
    paths.F_rescue.preds.push(fPred);
    paths.F_rescue.top3.push(cands.slice(0, 3).map((c) => c.latin));
    paths.F_rescue.lat.push(pnLat + (r.tier1?.latencyMs ?? 0));
    paths.F_rescue.cost.push(pnCost + llmCost(TIER1_MODEL, r.tier1?.usage));

    if (r.escalationReason) escalated++;
    // Tier-2, Tier-1'in yanlışını düzelttiyse say
    const cPred = resolveSpecies(t1, cands);
    if (t2 && !binomialMatch(cPred, r.truth) && binomialMatch(dPred, r.truth)) tier2Rescued++;
  }

  const n = records.length;
  const pct = (x) => `${((x / n) * 100).toFixed(1)}%`;

  const lines = [];
  lines.push(`# Plantie — Ölçüm Sonuçları\n`);
  lines.push(`Veri seti: ${n} görsel, GBIF CC0, uzman-doğrulamalı tür adları.`);
  lines.push(`Koşu: ${new Date().toISOString()}\n`);
  lines.push(`| Yol | top-1 (binomial) | top-1 (cins) | top-3 | p50 gecikme | p95 gecikme | maliyet/tanımlama |`);
  lines.push(`|---|---|---|---|---|---|---|`);

  for (const key of Object.keys(paths)) {
    const p = paths[key];
    const t1b = p.preds.filter((pred, i) => binomialMatch(pred, records[i].truth)).length;
    const t1g = p.preds.filter((pred, i) => genusMatch(pred, records[i].truth)).length;
    const t3 = p.top3.filter((list, i) => topKMatch(list, records[i].truth, 3)).length;
    const avgCost = p.cost.reduce((a, b) => a + b, 0) / n;
    lines.push(
      `| ${p.label} | ${pct(t1b)} | ${pct(t1g)} | ${pct(t3)} | ` +
        `${percentile(p.lat, 50)}ms | ${percentile(p.lat, 95)}ms | $${avgCost.toFixed(5)} |`,
    );
  }

  lines.push(`\n## Kademeleme davranışı\n`);
  lines.push(`- Tier-2'ye yükselen tanımlama: **${escalated}/${n}** (${pct(escalated)})`);
  lines.push(`- Tier-2'nin Tier-1'in hatasını düzelttiği vaka: **${tier2Rescued}**`);
  lines.push(`- Tier-1 JSON parse hatası: **${tier1ParseFail}/${n}**`);

  const reasons = {};
  for (const r of records) if (r.escalationReason) reasons[r.escalationReason] = (reasons[r.escalationReason] ?? 0) + 1;
  if (Object.keys(reasons).length) {
    lines.push(`\nTetikleyici dağılımı:\n`);
    for (const [k, v] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) lines.push(`- \`${k}\`: ${v}`);
  }

  const md = lines.join('\n') + '\n';
  console.log(md);

  writeFile(path.join(DIR, 'results.md'), md, 'utf8');

  const csvOut = [
    'filename,truth,A_plantnet,B_vlm,C_hybrid,D_cascade,escalation_reason',
    ...records.map((r, i) =>
      [
        r.filename,
        r.truth,
        paths.A_plantnet.preds[i] ?? '',
        paths.B_vlm.preds[i] ?? '',
        paths.C_hybrid.preds[i] ?? '',
        paths.D_cascade.preds[i] ?? '',
        r.escalationReason ?? '',
      ]
        .map((c) => `"${String(c).replaceAll('"', '""')}"`)
        .join(','),
    ),
  ].join('\n');
  writeFile(path.join(DIR, 'results.csv'), csvOut + '\n', 'utf8');

  console.log('→ eval/results.md ve eval/results.csv yazıldı.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
