import { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/layout';
import { useReduceMotion } from '@/lib/reduceMotion';

interface ShimmerProps {
  style?: ViewStyle;
}

/** Fills the slot while the sticker is still generating — sits at a fixed opacity under reduce-motion. */
export function Shimmer({ style }: ShimmerProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? 0.5 : 0.35);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.base, animatedStyle, style]} />;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: colors.lichen,
    borderRadius: radius.md,
  },
});
