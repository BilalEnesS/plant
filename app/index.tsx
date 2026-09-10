import { useEffect } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { Screen } from '@/ui/Screen';
import { Body, Caption, Title, Latin } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { useCollectionStore } from '@/store/useCollectionStore';
import { useLocaleStore, type Locale } from '@/store/useLocaleStore';
import { useReduceMotion } from '@/lib/reduceMotion';
import { useCopy } from '@/copy/useCopy';
import type { Discovery } from '@/db/types';

/**
 * Welcome — the app's real launch screen. NOTE: this was originally a
 * screen the "Botanik" spec deliberately forbade ("no onboarding/intro
 * screens", "camera = launch, no intermediate screen"). The user
 * knowingly asked to lift that constraint on 2026-09-09. The camera now
 * lives at /camera.
 *
 * The "Your collection" strip below shows real data when it exists; while
 * the collection is empty it shows decorative sample cards so the screen
 * feels like a real app home (approved by the user). The sample cards just
 * route to the camera on tap — they carry no real data.
 */

export default function WelcomeScreen() {
  const tr = useCopy();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const router = useRouter();
  const items = useCollectionStore((s) => s.items);
  const distinctSpeciesCount = useCollectionStore((s) => s.distinctSpeciesCount);
  const reduceMotion = useReduceMotion();

  const MOCK_PREVIEW: Array<{ latin: string; common: string; tint: string }> = [
    { latin: 'Monstera deliciosa', common: tr.mockMonstera, tint: colors.moss },
    { latin: 'Ficus lyrata', common: tr.mockFiddleLeaf, tint: colors.lichen },
    { latin: 'Sansevieria trifasciata', common: tr.mockSnakePlant, tint: colors.moss },
    { latin: 'Aloe vera', common: tr.mockAloe, tint: colors.lichen },
  ];

  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const scale = useSharedValue(reduceMotion ? 1 : 0.92);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
    scale.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, opacity, scale]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const previewItems = items.slice(0, 6);
  const showMock = previewItems.length === 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Image source={require('../assets/icon.png')} style={styles.headerIcon} />
          <Title style={styles.headerTitle}>{tr.appName}</Title>
          <View style={styles.languageToggle}>
            {(['tr', 'en'] as Locale[]).map((code) => (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                accessibilityRole="button"
                accessibilityLabel={code === 'tr' ? tr.languageTurkish : tr.languageEnglish}
                accessibilityState={{ selected: locale === code }}
                hitSlop={8}
                style={[styles.languageChip, locale === code && styles.languageChipActive]}
              >
                <Caption
                  color={locale === code ? colors.paper : colors.moss}
                  style={styles.languageChipText}
                >
                  {code.toUpperCase()}
                </Caption>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.hero}>
          <Animated.Image
            source={require('../assets/Plantie.png')}
            style={[styles.logo, logoStyle]}
            resizeMode="contain"
          />
          <Body color={colors.moss} style={styles.tagline}>
            {tr.welcomeTagline}
          </Body>
          <Button label={tr.findPlant} onPress={() => router.push('/camera')} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Title style={styles.sectionTitle}>{tr.yourCollection}</Title>
              {!showMock && (
                <Caption color={colors.moss}>{tr.speciesDiscovered(distinctSpeciesCount)}</Caption>
              )}
            </View>
            <Pressable onPress={() => router.push('/collection')}>
              <Caption color={colors.moss}>{tr.seeAll}</Caption>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
            {showMock
              ? MOCK_PREVIEW.map((m) => (
                  <Pressable key={m.latin} onPress={() => router.push('/camera')} style={styles.previewCard}>
                    <View style={[styles.previewArt, { backgroundColor: m.tint }]}>
                      <View style={styles.previewLeaf} />
                    </View>
                    <Caption numberOfLines={1}>{m.common}</Caption>
                    <Latin style={styles.previewLatin} numberOfLines={1}>
                      {m.latin}
                    </Latin>
                  </Pressable>
                ))
              : previewItems.map((item: Discovery) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/sticker/${item.id}`)}
                    style={styles.previewCard}
                  >
                    <View style={styles.previewArt}>
                      {item.stickerStatus === 'ready' && item.stickerUri ? (
                        <Image source={{ uri: item.stickerUri }} style={styles.previewImage} resizeMode="contain" />
                      ) : (
                        <View style={styles.previewLeaf} />
                      )}
                    </View>
                    <Caption numberOfLines={1}>{item.speciesCommonTr ?? item.speciesLatin}</Caption>
                  </Pressable>
                ))}
          </ScrollView>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing(10),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(6),
    paddingTop: spacing(4),
  },
  headerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
  },
  headerTitle: {
    fontSize: 20,
    flex: 1,
  },
  // Language choice without a settings screen — two small chips in the
  // header, keeping the spec's "no settings screen" rule intact.
  languageToggle: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  languageChip: {
    minWidth: 36,
    minHeight: 28,
    paddingHorizontal: spacing(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageChipActive: {
    backgroundColor: colors.moss,
    borderColor: colors.moss,
  },
  languageChipText: {
    fontSize: 11,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing(8),
    paddingTop: spacing(4),
    paddingBottom: spacing(8),
    gap: spacing(4),
  },
  logo: {
    width: 220,
    height: 220,
  },
  tagline: {
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: spacing(6),
    gap: spacing(3),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: 20,
  },
  previewRow: {
    gap: spacing(4),
    paddingBottom: spacing(2),
  },
  previewCard: {
    width: 108,
    gap: spacing(1),
  },
  previewArt: {
    width: 108,
    height: 108,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.hairline,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewLeaf: {
    width: 34,
    height: 34,
    backgroundColor: colors.paper,
    opacity: 0.85,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    transform: [{ rotate: '45deg' }],
  },
  previewLatin: {
    fontSize: 12,
  },
});
