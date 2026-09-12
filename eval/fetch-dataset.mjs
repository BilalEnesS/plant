/**
 * Downloads the labelled evaluation set from GBIF.
 *
 * WHY GBIF AND NOT PlantNet-300K:
 * Measuring the Pl@ntNet API on Pl@ntNet's own dataset is train/test
 * contamination — the specialist classifier looks artificially good on its
 * own training distribution, which suppresses whatever the hybrid path adds.
 * GBIF provides independent, expert-verified (HUMAN_OBSERVATION), CC0 images.
 *
 * The images are NOT committed (.gitignore: eval/photos/). dataset.csv is,
 * together with its attribution, so the set stays reproducible.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const TARGET_IMAGES = 36;
const MAX_PER_SPECIES = 2; // force species diversity — no pile-up on one species
const LONG_EDGE = 1280; // IDENTICAL to the app's prepare() step, so cost/latency stay faithful

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
      // Direct image files only — skip links to HTML pages
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

  console.log(`GBIF: selected ${chosen.length} images across ${perSpecies.size} species. Downloading…`);

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
      // Mirror the app's prepare() step: 1280px long edge, JPEG q80.
      await sharp(buf)
        .resize({ width: LONG_EDGE, height: LONG_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(dest);
      rows.push([filename, item.species, item.url, 'CC0-1.0', item.creator]);
      ok++;
      process.stdout.write(`\r  ${ok}/${chosen.length}`);
    } catch (err) {
      console.warn(`\n  skipped (${item.species}): ${err.message}`);
    }
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  await writeFile(path.join(import.meta.dirname, 'dataset.csv'), csv + '\n', 'utf8');

  console.log(`\n\nDone: ${ok} images, ${perSpecies.size} species → eval/photos/ + eval/dataset.csv`);
  console.log('All images are CC0-1.0; attribution is in dataset.csv.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
