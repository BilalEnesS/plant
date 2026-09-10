/**
 * GBIF'ten etiketli değerlendirme seti indirir.
 *
 * NEDEN GBIF, NEDEN PlantNet-300K DEĞİL:
 * Pl@ntNet'in kendi veri seti üzerinde Pl@ntNet API'sini ölçmek train/test
 * kontaminasyonudur — uzman sınıflandırıcı kendi eğitim dağılımında yapay
 * olarak iyi görünür ve hibrit yolun kazancı bastırılır. GBIF bağımsız,
 * uzman-doğrulamalı (HUMAN_OBSERVATION) ve CC0 lisanslı görsel sağlıyor.
 *
 * Görseller git'e GİRMEZ (.gitignore: eval/photos/). dataset.csv atıf
 * bilgisiyle birlikte commit edilir, böylece set yeniden üretilebilir.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const TARGET_IMAGES = 36;
const MAX_PER_SPECIES = 2; // tür çeşitliliğini zorla — tek türden yığılma olmasın
const LONG_EDGE = 1280; // uygulamanın prepare() adımıyla AYNI — maliyet/gecikme sadık olsun

const PHOTOS_DIR = path.join(import.meta.dirname, 'photos');
const MULTIMEDIA_EXT = 'http://rs.gbif.org/terms/1.0/Multimedia';

function mediaUrlOf(record) {
  const direct = record.media?.[0]?.identifier;
  if (direct) return direct;
  const ext = record.extensions?.[MULTIMEDIA_EXT]?.[0];
  return ext?.['http://purl.org/dc/terms/identifier'] ?? null;
}

function creatorOf(record) {
  const ext = record.extensions?.[MULTIMEDIA_EXT]?.[0];
  return ext?.['http://purl.org/dc/terms/creator'] ?? record.recordedBy ?? 'bilinmiyor';
}

async function fetchPage(offset) {
  const url =
    'https://api.gbif.org/v1/occurrence/search?' +
    new URLSearchParams({
      mediaType: 'StillImage',
      license: 'CC0_1_0',
      kingdomKey: '6', // Plantae
      taxonRank: 'SPECIES',
      basisOfRecord: 'HUMAN_OBSERVATION',
      limit: '100',
      offset: String(offset),
    });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GBIF ${res.status}`);
  return res.json();
}

async function main() {
  await mkdir(PHOTOS_DIR, { recursive: true });

  const perSpecies = new Map();
  const chosen = [];
  let offset = 0;

  while (chosen.length < TARGET_IMAGES && offset < 2000) {
    const page = await fetchPage(offset);
    offset += 100;
    if (!page.results?.length) break;

    for (const r of page.results) {
      if (chosen.length >= TARGET_IMAGES) break;
      const species = r.species;
      const url = mediaUrlOf(r);
      if (!species || !url) continue;
      // Yalnızca doğrudan görsel dosyaları — HTML sayfa linklerini ele
      if (!/\.(jpe?g|png)(\?|$)/i.test(url)) continue;

      const seen = perSpecies.get(species) ?? 0;
      if (seen >= MAX_PER_SPECIES) continue;
      perSpecies.set(species, seen + 1);

      chosen.push({
        species,
        url,
        creator: creatorOf(r),
        gbifKey: r.key,
      });
    }
  }

  console.log(`GBIF: ${chosen.length} görsel, ${perSpecies.size} farklı tür seçildi. İndiriliyor…`);

  const rows = [['filename', 'correct_latin', 'source_url', 'license', 'creator']];
  let ok = 0;

  for (const [i, item] of chosen.entries()) {
    const filename = `${String(i + 1).padStart(3, '0')}.jpg`;
    const dest = path.join(PHOTOS_DIR, filename);

    if (existsSync(dest)) {
      rows.push([filename, item.species, item.url, 'CC0-1.0', item.creator]);
      ok++;
      continue;
    }

    try {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // Uygulamanın prepare() adımını taklit et: uzun kenar 1280, JPEG q80.
      await sharp(buf)
        .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(dest);
      rows.push([filename, item.species, item.url, 'CC0-1.0', item.creator]);
      ok++;
      process.stdout.write(`\r  ${ok}/${chosen.length}`);
    } catch (err) {
      console.warn(`\n  atlandı (${item.species}): ${err.message}`);
    }
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  await writeFile(path.join(import.meta.dirname, 'dataset.csv'), csv + '\n', 'utf8');

  console.log(`\n\nHazır: ${ok} görsel, ${perSpecies.size} tür → eval/photos/ + eval/dataset.csv`);
  console.log('Tüm görseller CC0-1.0; atıf bilgisi dataset.csv içinde.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
