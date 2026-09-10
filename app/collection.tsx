import { useCallback, useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';
import { Screen } from '@/ui/Screen';
import { Body, Caption, Title } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { Shimmer } from '@/ui/Shimmer';
import { StickerReveal } from '@/ui/StickerReveal';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useCopy } from '@/copy/useCopy';
import type { Discovery } from '@/db/types';

/**
 * Collection — the sticker album. The grid shows only REAL records, wrapping
 * naturally in 3 columns (no empty placeholder slots — removed at the
 * user's request: they wasted space and distorted the layout). The counter
 * comes from distinctSpeciesCount, NOT items.length.
 *
 * Press-and-hold drag reordering (react-native-draggable-flatlist): on drop,
 * the new order applies immediately (optimistic), persisted in the
 * background via discoveries.reorder() — see useCollectionStore.
 */
export default function CollectionScreen() {
  const tr = useCopy();
  const router = useRouter();
  const items = useCollectionStore((s) => s.items);
  const distinctSpeciesCount = useCollectionStore((s) => s.distinctSpeciesCount);
  const revealedIds = useCollectionStore((s) => s.revealedIds);
  const hydrated = useCollectionStore((s) => s.hydrated);
  const hydrate = useCollectionStore((s) => s.hydrate);
  const refresh = useCollectionStore((s) => s.refresh);
  const markRevealed = useCollectionStore((s) => s.markRevealed);
  const reorder = useCollectionStore((s) => s.reorder);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useFocusEffect(
    useCallback(() => {
      if (hydrated) refresh();
    }, [hydrated, refresh]),
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Title>{tr.collectionTitle}</Title>
        {items.length > 0 && (
          <>
            <Caption color={colors.moss}>{tr.speciesDiscovered(distinctSpeciesCount)}</Caption>
            <Caption color={colors.moss}>{tr.dragToReorder}</Caption>
          </>
        )}
      </View>

      {items.length === 0 && hydrated ? (
        <View style={styles.empty}>
          <Body style={styles.emptyText}>{tr.emptyCollection}</Body>
          <Button label={tr.findPlant} onPress={() => router.replace('/camera')} />
        </View>
      ) : (
        <DraggableFlatList
          data={items}
          numColumns={3}
          keyExtractor={(item: Discovery) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          onDragEnd={({ data }) => reorder(data)}
          renderItem={({ item, drag, isActive }: RenderItemParams<Discovery>) => (
            <CollectionSlot
              item={item}
              revealed={revealedIds.has(item.id)}
              dragging={isActive}
              onReveal={() => markRevealed(item.id)}
              onPress={() => router.push(`/sticker/${item.id}`)}
              onLongPress={drag}
            />
          )}
        />
      )}

      {items.length > 0 && (
        <View style={styles.footer}>
          <Button label={tr.findPlant} onPress={() => router.replace('/camera')} />
        </View>
      )}
    </Screen>
  );
}

function CollectionSlot({
  item,
  revealed,
  dragging,
  onReveal,
  onPress,
  onLongPress,
}: {
  item: Discovery;
  revealed: boolean;
  dragging: boolean;
  onReveal: () => void;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const tr = useCopy();
  const name = item.speciesCommonTr ?? item.speciesLatin;

  let content;
  if (item.stickerStatus === 'ready' && item.stickerUri) {
    const image = <Image source={{ uri: item.stickerUri }} style={styles.stickerImage} resizeMode="contain" />;
    content = revealed ? image : <StickerReveal onFinish={onReveal}>{image}</StickerReveal>;
  } else if (item.stickerStatus === 'failed') {
    content = (
      <View style={styles.failedPlaceholder}>
        <Caption color={colors.signal} style={styles.retryText}>
          {tr.retry}
        </Caption>
      </View>
    );
  } else {
    content = <Shimmer />;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      style={[styles.filledSlot, dragging && styles.filledSlotDragging]}
    >
      <View style={styles.slotImageWrap}>{content}</View>
      <Caption style={styles.slotName} numberOfLines={1}>
        {name}
      </Caption>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing(6),
    paddingTop: spacing(4),
    gap: spacing(1),
  },
  grid: {
    padding: spacing(6),
    gap: spacing(4),
  },
  row: {
    gap: spacing(4),
  },
  footer: {
    padding: spacing(6),
  },
  // Fixed width (NOT flex:1) — even if the last row has fewer than 3 items,
  // slots don't stretch out of proportion; avoids repeating the earlier
  // "layout distortion" bug.
  filledSlot: {
    width: '31%',
    gap: spacing(1),
  },
  filledSlotDragging: {
    opacity: 0.8,
    transform: [{ scale: 1.04 }],
  },
  slotImageWrap: {
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  failedPlaceholder: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.signal,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    textAlign: 'center',
  },
  slotName: {
    textAlign: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    paddingHorizontal: spacing(8),
  },
  emptyText: {
    textAlign: 'center',
  },
});
