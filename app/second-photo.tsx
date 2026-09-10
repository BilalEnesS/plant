import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/ui/Screen';
import { Body, Caption, Title } from '@/ui/Text';
import { Button } from '@/ui/Button';
import { ScanningOverlay } from '@/ui/ScanningOverlay';
import { colors } from '@/theme/colors';
import { spacing, radius, TOUCH_MIN } from '@/theme/layout';
import { identify } from '@/services/pipeline';
import { useSessionStore } from '@/store/useSessionStore';
import { messageFor } from '@/errors/AppError';
import { useCopy } from '@/copy/useCopy';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { IdentifyStage, Organ } from '@/services/types';

/**
 * The low-confidence loop — the screen the spec calls "the part that
 * matters most." A sanctioned extra route: not on the forbidden list,
 * needed for the second-photo flow. We don't re-prepare the first photo;
 * identify() sends both together with attempt:2.
 */
export default function SecondPhotoScreen() {
  const tr = useCopy();
  const locale = useLocaleStore((s) => s.locale);
  const ORGANS: Array<{ value: Organ; label: string }> = [
    { value: 'leaf', label: tr.organLeaf },
    { value: 'flower', label: tr.organFlower },
    { value: 'fruit', label: tr.organFruit },
    { value: 'bark', label: tr.organBark },
  ];
  const router = useRouter();
  const session = useSessionStore((s) => s.secondPhotoSession);
  const setLastResult = useSessionStore((s) => s.setLastResult);
  const setSecondPhotoSession = useSessionStore((s) => s.setSecondPhotoSession);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [organ, setOrgan] = useState<Organ | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [stage, setStage] = useState<IdentifyStage>('preparing');
  /**
   * The second-photo attempt is ONE-TIME ONLY. If used and the result isn't
   * 'identified', the screen locks and the only way out is "Back to camera."
   *
   * Why: Pl@ntNet's multi-image feature is for different angles of the SAME
   * plant; without locking, a user could stay on this screen and upload a
   * completely different plant, which the system would send together with
   * the first photo — resulting in a thistle photo returning a rose result
   * (observed on-device 2026-09-09).
   */
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    if (permission?.status === 'undetermined') requestPermission();
  }, [permission?.status, requestPermission]);

  useEffect(() => {
    if (!session) router.replace('/camera');
  }, [session, router]);

  if (!session) return null;
  const activeSession = session;

  function backToCamera() {
    // Clear the session — prevents the stale image from leaking into later identifications.
    setSecondPhotoSession(null);
    router.replace('/camera');
  }

  async function runSecondPhoto(uri: string, width: number, height: number) {
    if (!organ || processing || exhausted) return;
    setProcessing(true);
    setStage('preparing');
    setMessage(null);
    setCapturedUri(uri);
    try {
      const first = activeSession.images[0];
      const outcome = await identify({
        attempt: 2,
        onStage: setStage,
        locale,
        images: [
          { uri: first.uri, width: first.width, height: first.height, organ: first.organ },
          { uri, width, height, organ },
        ],
      });

      switch (outcome.kind) {
        case 'identified':
          setSecondPhotoSession(null);
          setLastResult(outcome.plant);
          router.replace('/result');
          return;
        case 'low-confidence-exhausted':
          setExhausted(true);
          setMessage(tr.lowConfidenceExhausted);
          return;
        case 'not-a-plant':
          setExhausted(true);
          setMessage(tr.notAPlant);
          return;
        case 'blurry':
          // Blur is the one recoverable case — doesn't burn the attempt, can retry.
          setMessage(tr.blurry);
          return;
        case 'needs-second-photo':
          // attempt:2 never returns this kind (pipeline.ts caps at two attempts) — a safety net.
          setExhausted(true);
          setMessage(tr.lowConfidenceExhausted);
          return;
        case 'error':
          // A transient error — doesn't burn the attempt.
          setMessage(messageFor(outcome.error));
          return;
      }
    } finally {
      setProcessing(false);
      setCapturedUri(null);
    }
  }

  const canSubmit = Boolean(organ) && !processing && !exhausted;

  async function handleShutter() {
    if (!cameraRef.current || !cameraReady || !canSubmit) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 1 });
    if (!photo) return;
    await runSecondPhoto(photo.uri, photo.width, photo.height);
  }

  async function handleGalleryPick() {
    if (!canSubmit) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await runSecondPhoto(asset.uri, asset.width, asset.height);
  }

  return (
    <Screen dark>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Title color={colors.paper}>{tr.chooseOrgan}</Title>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr.giveUpA11y}
            onPress={backToCamera}
            style={styles.giveUpButton}
          >
            <Caption color={colors.paper}>{tr.giveUp}</Caption>
          </Pressable>
        </View>
        <Body color={colors.paper}>{tr.lowConfidenceIntro}</Body>

        <View style={styles.chips}>
          {ORGANS.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => setOrgan(o.value)}
              style={[styles.chip, organ === o.value && styles.chipSelected]}
            >
              <Caption color={organ === o.value ? colors.ink : colors.paper}>{o.label}</Caption>
            </Pressable>
          ))}
        </View>
      </View>

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

        {message && (
          <View style={styles.banner}>
            <Caption color={colors.paper} style={styles.bannerText}>
              {message}
            </Caption>
            <Button label={tr.backToCamera} onPress={backToCamera} />
          </View>
        )}

        {processing && <ScanningOverlay stage={stage} />}
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.galleryA11y}
          disabled={!canSubmit}
          onPress={handleGalleryPick}
          style={[styles.sideButton, !canSubmit && styles.shutterDisabled]}
        >
          <View style={styles.galleryIcon} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr.shutterA11y}
          disabled={!canSubmit || !permission?.granted || !cameraReady}
          onPress={handleShutter}
          style={[
            styles.shutter,
            (!canSubmit || !permission?.granted || !cameraReady) && styles.shutterDisabled,
          ]}
        >
          <View style={styles.shutterInner} />
        </Pressable>

        <View style={styles.sideButton} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing(6),
    gap: spacing(3),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  giveUpButton: {
    minHeight: TOUCH_MIN,
    minWidth: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
  },
  chip: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing(4),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.lichen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.lichen,
  },
  viewfinder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginHorizontal: spacing(6),
    borderRadius: radius.lg,
  },
  frame: {
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderColor: colors.lichen,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
  },
  banner: {
    position: 'absolute',
    top: spacing(4),
    left: spacing(4),
    right: spacing(4),
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(3),
  },
  bannerText: {
    textAlign: 'center',
  },
  overlay: {
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(3),
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(8),
    paddingVertical: spacing(6),
  },
  sideButton: {
    minWidth: TOUCH_MIN,
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryIcon: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderColor: colors.paper,
    borderRadius: radius.sm,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.paper,
  },
});
