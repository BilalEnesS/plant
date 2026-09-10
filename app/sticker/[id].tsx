import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/ui/Screen';
import { Title, Latin, Body, Caption } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { LabelRow } from '@/ui/LabelRow';
import { Shimmer } from '@/ui/Shimmer';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { useCollectionStore } from '@/store/useCollectionStore';
import { discoveries } from '@/db/discoveries';
import { stickerQueue } from '@/services/stickerQueue';
import { useCopy } from '@/copy/useCopy';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { Discovery } from '@/db/types';

export default function StickerDetailScreen() {
  const tr = useCopy();
  const locale = useLocaleStore((s) => s.locale);
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const storeItem = useCollectionStore((s) => s.items.find((i) => i.id === id));
  const remove = useCollectionStore((s) => s.remove);

  const [fallbackItem, setFallbackItem] = useState<Discovery | null>(null);

  useEffect(() => {
    if (!storeItem && id) {
      discoveries.getById(id).then(setFallbackItem);
    }
  }, [storeItem, id]);

  const item = storeItem ?? fallbackItem;

  if (!item) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Body>{tr.recordNotFound}</Body>
          <Button label={tr.close} variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const activeItem = item;

  function handleRetry() {
    if (!activeItem.stickerTraits) return;
    stickerQueue.retry(activeItem.id, activeItem.speciesLatin, activeItem.stickerTraits);
  }

  async function handleDelete() {
    await remove(activeItem.id);
    router.back();
  }

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.closeRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.close}
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Caption color={colors.moss}>{tr.close}</Caption>
          </Pressable>
        </View>

        <View style={styles.stickerWrap}>
          {item.stickerStatus === 'ready' && item.stickerUri ? (
            <Image source={{ uri: item.stickerUri }} style={styles.sticker} resizeMode="contain" />
          ) : item.stickerStatus === 'failed' ? (
            <View style={styles.failedBox}>
              <Caption color={colors.signal}>{tr.stickerGenerationFailed}</Caption>
              <Button label={tr.retry} variant="secondary" onPress={handleRetry} />
            </View>
          ) : (
            <Shimmer style={styles.sticker} />
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Image source={{ uri: item.photoUri }} style={styles.thumb} resizeMode="cover" />
            <View style={styles.nameBlock}>
              <Title>{item.speciesCommonTr ?? item.speciesLatin}</Title>
              <Latin>{item.speciesLatin}</Latin>
              <Caption color={colors.moss}>{dateFormatter.format(item.createdAt)}</Caption>
            </View>
          </View>

          {item.care && (
            <View style={styles.labelBlock}>
              <LabelRow label={tr.careWater} value={item.care.water} />
              <LabelRow label={tr.careLight} value={item.care.light} />
              <LabelRow label={tr.careSoil} value={item.care.soil} />
              {item.toxicToPets && (
                <LabelRow label={tr.carePets} value={item.toxicityNote ?? tr.toxicToPets} warn />
              )}
            </View>
          )}

          <Button
            label={tr.askAboutPlant}
            variant="secondary"
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: activeItem.id } })}
          />

          <Button label={tr.delete} variant="ghost" onPress={handleDelete} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing(6),
    gap: spacing(4),
  },
  closeRow: {
    alignItems: 'flex-end',
  },
  closeButton: {
    minHeight: 44,
    paddingHorizontal: spacing(2),
    justifyContent: 'center',
  },
  stickerWrap: {
    alignItems: 'center',
  },
  sticker: {
    width: 220,
    height: 220,
  },
  failedBox: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
    borderWidth: 1.5,
    borderColor: colors.signal,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  body: {
    gap: spacing(4),
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing(4),
    alignItems: 'center',
  },
  thumb: {
    width: 64,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.hairline,
  },
  nameBlock: {
    flex: 1,
    gap: spacing(1),
  },
  labelBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
  },
});
