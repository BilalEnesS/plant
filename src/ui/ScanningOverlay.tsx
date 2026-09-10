import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { Caption } from '@/ui/Text';
import { useReduceMotion } from '@/lib/reduceMotion';
import { useCopy } from '@/copy/useCopy';
import type { IdentifyStage } from '@/services/types';

/**
 * Scanning overlay — kills the "am I just waiting for nothing" feeling.
 *
 * Two design decisions:
 * 1. A sweeping scan line + pulsing corner brackets: the established visual
 *    language of scanner apps, so the user sees the device "looking."
 * 2. The stage text is NOT fabricated — it comes from pipeline.ts's real
 *    steps (preparing → classifying → verifying → adjudicating → saving).
 *    A fake progress bar would be misleading; every sentence shown here
 *    describes what's actually happening right now.
 */
interface ScanningOverlayProps {
  stage: IdentifyStage;
}

export function ScanningOverlay({ stage }: ScanningOverlayProps) {
  const tr = useCopy();
  const stageText: Record<IdentifyStage, string> = {
    preparing: tr.stagePreparing,
    classifying: tr.stageClassifying,
    verifying: tr.stageVerifying,
    adjudicating: tr.stageAdjudicating,
    saving: tr.stageSaving,
  };
  const reduceMotion = useReduceMotion();

  const sweep = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true, // sweep back and forth
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [reduceMotion, sweep, pulse]);

  // SAME size as the camera screen's aim-frame (76% width, 4:5). So the
  // frame doesn't shift when scanning starts — the user sees the area they
  // aligned actually being scanned.
  const { width } = useWindowDimensions();
  const frameWidth = width * 0.76;
  const frameHeight = frameWidth * (5 / 4);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * frameHeight }],
    opacity: reduceMotion ? 0 : 1,
  }));
  const cornerStyle = useAnimatedStyle(() => ({ opacity: reduceMotion ? 1 : pulse.value }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
        <Animated.View style={[styles.corner, styles.tl, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.tr, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.bl, cornerStyle]} />
        <Animated.View style={[styles.corner, styles.br, cornerStyle]} />
        <Animated.View style={[styles.scanGlow, lineStyle]} />
        <Animated.View style={[styles.scanLine, lineStyle]} />
      </View>

      <View style={styles.label}>
        <Caption color={colors.paper} style={styles.labelText}>
          {stageText[stage]}
        </Caption>
      </View>
    </View>
  );
}

const CORNER = 34;
const CORNER_W = 3;

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 36, 28, 0.35)',
  },
  frame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
  },
  // A thin, crisp line on top of the glow — together they give a soft
  // "light sweeping across" feel (without adding a gradient package).
  scanGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 26,
    marginTop: -12,
    backgroundColor: colors.lichen,
    opacity: 0.18,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.lichen,
    shadowColor: colors.lichen,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: colors.paper,
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopLeftRadius: radius.md },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopRightRadius: radius.md },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomLeftRadius: radius.md },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: radius.md },
  label: {
    position: 'absolute',
    bottom: spacing(14),
    left: spacing(6),
    right: spacing(6),
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(5),
  },
  labelText: {
    textAlign: 'center',
  },
});
