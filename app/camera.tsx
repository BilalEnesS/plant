import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/ui/Screen';
import { Caption, Title } from '@/ui/Text';
import { ScanningOverlay } from '@/ui/ScanningOverlay';
import { LeafMark } from '@/ui/LeafMark';
import { colors } from '@/theme/colors';
import { spacing, radius, TOUCH_MIN } from '@/theme/layout';
import { identify } from '@/services/pipeline';
import { useSessionStore } from '@/store/useSessionStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import { messageFor } from '@/errors/AppError';
import { useCopy } from '@/copy/useCopy';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { IdentifyStage } from '@/services/types';

/**
 * Camera — /camera. The live viewfinder shows the instant it mounts, no
 * intermediate permission screen. After a shutter/gallery pick, it goes
 * through identify()'s single entry point and routes based on the outcome kind.
 */
export default function CameraScreen() {
  const tr = useCopy();
  const locale = useLocaleStore((s) => s.locale);
  const router = useRouter();
  const setLastResult = useSessionStore((s) => s.setLastResult);
  const setSecondPhotoSession = useSessionStore((s) => s.setSecondPhotoSession);
  const distinctSpeciesCount = useCollectionStore((s) => s.distinctSpeciesCount);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  // The instant the shot is taken, swap the viewfinder for this photo — a
  // visual cue that the user no longer needs to keep holding the phone at
  // the plant. Analysis looks at this captured frame, not the live camera.
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [stage, setStage] = useState<IdentifyStage>('preparing');

  useEffect(() => {
    if (permission?.status === 'undetermined') {
      requestPermission();
    }
  }, [permission?.status, requestPermission]);

  const permissionDenied = permission !== null && !permission.granted && permission.status !== 'undetermined';

  async function handleOutcome(uri: string, width: number, height: number) {
    setProcessing(true);
    setStage('preparing');
    setBanner(null);
    // A new identification = a clean slate. Any leftover second-photo
    // session from a prior round is cleared here; this is the second line
    // of defense (the first is second-photo.tsx locking itself).
    setSecondPhotoSession(null);
    try {
      const outcome = await identify({
        images: [{ uri, width, height }],
        attempt: 1,
        onStage: setStage,
        locale,
      });

      switch (outcome.kind) {
        case 'identified':
          setLastResult(outcome.plant);
          router.push('/result');
          return;
        case 'needs-second-photo':
          setSecondPhotoSession(outcome.session);
          router.push('/second-photo');
          return;
        case 'not-a-plant':
          setBanner(tr.notAPlant);
          return;
        case 'blurry':
          setBanner(tr.blurry);
          return;
        case 'low-confidence-exhausted':
          // The pipeline never returns this on attempt:1 — a safety net.
          setBanner(tr.lowConfidenceExhausted);
          return;
        case 'error':
          setBanner(messageFor(outcome.error));
          return;
      }
    } finally {
      setProcessing(false);
      // 'identified' / 'needs-second-photo' already navigated away (unmount);
      // if we're still here (a banner was shown), return to the live camera.
      setCapturedUri(null);
    }
  }

  async function handleShutter() {
    if (!cameraRef.current || !cameraReady || processing) return;
    // Shutter haptic feedback — lets the user feel the shot happened
    // without looking at the screen; the analog of a physical shutter.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
    if (!photo) return;
    setCapturedUri(photo.uri);
    await handleOutcome(photo.uri, photo.width, photo.height);
  }

  async function handleGalleryPick() {
    if (processing) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCapturedUri(asset.uri);
    await handleOutcome(asset.uri, asset.width, asset.height);
  }

  return (
    <Screen dark>
      <View style={styles.viewfinder}>
        {capturedUri ? (
          <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : permission?.granted ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setCameraReady(true)}
          />
        ) : (
          <View style={styles.frame} />
        )}

        <View style={styles.titleChip} pointerEvents="none">
          <LeafMark size={16} color={colors.lichen} />
          <Title color={colors.paper} style={styles.titleText}>
            {tr.appName}
          </Title>
        </View>

        {!capturedUri && permission?.granted && (
          <View style={styles.aimFrame} pointerEvents="none">
            <View style={[styles.aimCorner, styles.aimTl]} />
            <View style={[styles.aimCorner, styles.aimTr]} />
            <View style={[styles.aimCorner, styles.aimBl]} />
            <View style={[styles.aimCorner, styles.aimBr]} />
          </View>
        )}

        {!capturedUri && (
          <View style={styles.hintWrap} pointerEvents="none">
            <View style={styles.hintPill}>
              <Caption color={colors.paper} style={styles.hint}>
                {permissionDenied ? tr.cameraPermissionDenied : tr.cameraHint}
              </Caption>
            </View>
          </View>
        )}

        {banner && (
          <View style={styles.banner}>
            <Caption color={colors.paper} style={styles.bannerText}>
              {banner}
            </Caption>
            <Pressable onPress={() => setBanner(null)}>
              <Caption color={colors.signal}>{tr.retry}</Caption>
            </Pressable>
          </View>
        )}

        {processing && <ScanningOverlay stage={stage} />}
      </View>

      <View style={styles.bottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.galleryA11y}
          onPress={handleGalleryPick}
          style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
        >
          <View style={styles.galleryIcon}>
            <View style={styles.galleryIconBack} />
          </View>
          <Caption color={colors.paper} style={styles.sideLabel}>
            {tr.gallery}
          </Caption>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.shutterA11y}
          accessibilityState={{ disabled: !permission?.granted || !cameraReady || processing }}
          onPress={handleShutter}
          disabled={!permission?.granted || !cameraReady || processing}
          style={({ pressed }) => [
            styles.shutter,
            pressed && styles.shutterPressed,
            (!permission?.granted || !cameraReady || processing) && styles.shutterDisabled,
          ]}
        >
          <View style={styles.shutterInner}>
            <LeafMark size={26} color={colors.moss} />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${tr.collectionA11y}, ${tr.speciesDiscovered(distinctSpeciesCount)}`}
          onPress={() => router.push('/collection')}
          style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
        >
          <View style={styles.collectionIcon}>
            <LeafMark size={18} color={colors.lichen} />
            {distinctSpeciesCount > 0 && (
              <View style={styles.badge}>
                <Caption color={colors.paper} style={styles.badgeText}>
                  {distinctSpeciesCount}
                </Caption>
              </View>
            )}
          </View>
          <Caption color={colors.paper} style={styles.sideLabel}>
            {tr.collection}
          </Caption>
        </Pressable>
      </View>
    </Screen>
  );
}

const AIM = 40;
const AIM_W = 3;

const styles = StyleSheet.create({
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frame: {
    width: '80%',
    aspectRatio: 4 / 5,
    borderWidth: 1.5,
    borderColor: colors.lichen,
    borderRadius: radius.md,
    borderStyle: 'dashed',
  },

  // A persistent aim-frame while the camera is active — the user sees where
  // to align BEFORE scanning starts; the established visual language of scanner apps.
  aimFrame: {
    position: 'absolute',
    width: '76%',
    aspectRatio: 4 / 5,
  },
  aimCorner: {
    position: 'absolute',
    width: AIM,
    height: AIM,
    borderColor: colors.lichen,
  },
  aimTl: { top: 0, left: 0, borderTopWidth: AIM_W, borderLeftWidth: AIM_W, borderTopLeftRadius: radius.lg },
  aimTr: { top: 0, right: 0, borderTopWidth: AIM_W, borderRightWidth: AIM_W, borderTopRightRadius: radius.lg },
  aimBl: { bottom: 0, left: 0, borderBottomWidth: AIM_W, borderLeftWidth: AIM_W, borderBottomLeftRadius: radius.lg },
  aimBr: { bottom: 0, right: 0, borderBottomWidth: AIM_W, borderRightWidth: AIM_W, borderBottomRightRadius: radius.lg },

  // A floating, rounded brand chip instead of a full-width dark band — feels lighter.
  titleChip: {
    position: 'absolute',
    top: spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  titleText: {
    fontSize: 18,
  },
  hintWrap: {
    position: 'absolute',
    bottom: spacing(5),
    left: spacing(6),
    right: spacing(6),
    alignItems: 'center',
  },
  hintPill: {
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(4),
  },
  hint: {
    textAlign: 'center',
  },
  banner: {
    position: 'absolute',
    top: spacing(16),
    left: spacing(6),
    right: spacing(6),
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(2),
  },
  bannerText: {
    textAlign: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(7),
    paddingVertical: spacing(5),
  },
  sideButton: {
    minWidth: 64,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
  },
  sideLabel: {
    fontSize: 11,
  },
  pressed: {
    opacity: 0.6,
  },
  // Two overlapping squares — conveys "gallery" better than a single square.
  galleryIcon: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.paper,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  galleryIconBack: {
    position: 'absolute',
    top: -5,
    left: 4,
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.lichen,
    borderRadius: radius.sm,
    opacity: 0.7,
  },
  collectionIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Discovered-species-count badge — requested by the spec, now actually implemented.
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bloom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterPressed: {
    transform: [{ scale: 0.94 }],
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
