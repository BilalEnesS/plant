import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Title, Latin, Body, Micro } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { LabelRow } from '@/ui/LabelRow';
import { ConfidenceIndicator } from '@/ui/ConfidenceIndicator';
import { CandidateList } from '@/ui/CandidateList';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { useSessionStore } from '@/store/useSessionStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { discoveries } from '@/db/discoveries';
import { stickerQueue } from '@/services/stickerQueue';
import { useCopy } from '@/copy/useCopy';
import type { Candidate } from '@/services/types';

/**
 * Herbarium-label layout. "Add to collection" does real persistence (SQLite
 * + sticker queue) as of Phase 4 — before that it just navigated to the
 * collection screen.
 */
export default function ResultScreen() {
  const tr = useCopy();
  const router = useRouter();
  const plant = useSessionStore((s) => s.lastResult);
  const setLastResult = useSessionStore((s) => s.setLastResult);

  const [primary, setPrimary] = useState<Candidate | null>(
    plant
      ? {
          latin: plant.speciesLatin,
          commonNames: plant.speciesCommonTr ? [plant.speciesCommonTr] : [],
          score: plant.confidence,
          gbifId: null,
        }
      : null,
  );
  const [alternatives, setAlternatives] = useState<Candidate[]>(plant?.alternatives ?? []);

  if (!plant || !primary) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Body>{tr.recordNotFound}</Body>
          <Button label={tr.backToCamera} variant="ghost" onPress={() => router.replace('/camera')} />
        </View>
      </Screen>
    );
  }

  /**
   * The user picking an alternative is a real correction, so it has to reach
   * everything the original species reached — not just this screen.
   *
   * The row is ALREADY persisted by the time this screen renders (pipeline.ts
   * saves before returning 'identified'), so an earlier version that only
   * called setPrimary() left the SQLite row, the collection, the sticker and
   * the chat grounding all pointing at the species the user had just
   * rejected: the header changed and nothing else did.
   *
   * The sticker is re-queued because it is keyed by species. `stickerTraits`
   * are reused deliberately — they describe the photo, which has not changed.
   */
  function handleSwap(candidate: Candidate) {
    // Re-checked rather than relying on the guard above: TypeScript does not
    // carry that narrowing into this closure.
    if (!primary || !plant) return;
    const record = plant;
    const previous = primary;
    const common = candidate.commonNames[0] ?? null;

    setAlternatives((prev) => [previous, ...prev.filter((c) => c.latin !== candidate.latin)]);
    setPrimary(candidate);

    // Keep the session copy in step, so navigating to the chat from here
    // grounds it in the species now on screen.
    setLastResult({ ...record, speciesLatin: candidate.latin, speciesCommonTr: common });

    void (async () => {
      await discoveries.setSpecies(record.id, candidate.latin, common);
      if (record.stickerTraits) {
        stickerQueue.retry(record.id, candidate.latin, record.stickerTraits);
      }
      await useCollectionStore.getState().refresh();
    })();
  }

  // The name is shown plainly. The hedge lives in ConfidenceIndicator alone —
  // prefixing the title with "Most likely" both weakened the name and said
  // the same thing the badge right below it already says.
  const displayName = primary.commonNames[0] ?? primary.latin;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={{ uri: plant.photoUri }} style={styles.photo} resizeMode="cover" />

        <View style={styles.body}>
          <View style={styles.nameBlock}>
            <Title>{displayName}</Title>
            <Latin>{primary.latin}</Latin>
          </View>

          <ConfidenceIndicator band={plant.confidenceBand} downgraded={plant.bandDowngraded} />

          {plant.isDuplicate && <Micro color={colors.signal}>{tr.duplicateSpecies}</Micro>}

          {plant.care && (
            <View style={styles.labelBlock}>
              <LabelRow label={tr.careWater} value={plant.care.water} />
              <LabelRow label={tr.careLight} value={plant.care.light} />
              <LabelRow label={tr.careSoil} value={plant.care.soil} />
              {plant.toxicToPets && (
                <LabelRow label={tr.carePets} value={plant.toxicityNote ?? tr.toxicToPets} warn />
              )}
            </View>
          )}

          {!plant.viaVlmFallback && (plant.confidenceBand === 'medium' || plant.confidenceBand === 'low') && (
            <CandidateList candidates={alternatives} onSelect={handleSwap} />
          )}

          <Button
            label={tr.addToCollection}
            onPress={() => router.replace('/collection')}
          />

          {/* The row is already persisted by the time this screen renders
              (pipeline.ts saves before returning 'identified'), so the chat
              has a real discovery id to ground itself in. */}
          <Button
            label={tr.askAboutPlant}
            variant="secondary"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: plant.id } })}
          />

          <Micro color={colors.moss} style={styles.attribution}>
            {tr.plantnetAttribution}
          </Micro>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing(8),
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: colors.hairline,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  body: {
    padding: spacing(6),
    gap: spacing(4),
  },
  nameBlock: {
    gap: spacing(1),
  },
  labelBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  attribution: {
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
  },
});
