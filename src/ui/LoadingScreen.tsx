import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/layout';
import { Body } from '@/ui/Text';
import { useReduceMotion } from '@/lib/reduceMotion';
import { useCopy } from '@/copy/useCopy';

const TAGLINE_INTERVAL_MS = 1800;

/**
 * The native splash hides the instant JS mounts (see _layout.tsx) and this
 * screen takes over — fixes the "still seeing something old/unbranded while
 * loading" complaint: the user always sees the Plantie logo and a rotating
 * tagline, no matter how long DB/font setup takes.
 */
export function LoadingScreen() {
  const tr = useCopy();
  const TAGLINES = [tr.taglineDiscover, tr.taglineIdentify, tr.taglineGrow, tr.taglineCollect];
  const reduceMotion = useReduceMotion();
  const [taglineIndex, setTaglineIndex] = useState(0);
  const scale = useSharedValue(1);
  const textOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;

    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );

    const interval = setInterval(() => {
      textOpacity.value = withSequence(withTiming(0, { duration: 220 }), withTiming(1, { duration: 260 }));
      setTimeout(() => setTaglineIndex((i) => (i + 1) % TAGLINES.length), 220);
    }, TAGLINE_INTERVAL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../assets/Plantie.png')}
        resizeMode="contain"
        style={[styles.logo, !reduceMotion && logoStyle]}
      />
      <Animated.View style={!reduceMotion && textStyle}>
        <Body color={colors.moss} style={styles.tagline}>
          {TAGLINES[taglineIndex]}
        </Body>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    gap: spacing(5),
  },
  logo: {
    width: 260,
    height: 260,
  },
  tagline: {
    textAlign: 'center',
  },
});
