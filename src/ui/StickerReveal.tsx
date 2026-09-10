import { PropsWithChildren, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from '@/lib/reduceMotion';

interface StickerRevealProps extends PropsWithChildren {
  onFinish: () => void;
}

/**
 * The app's ONE choreographed moment: scale 0.9→1.0, a ±3° rotation settle,
 * a success haptic at the start. Under reduce-motion there's no
 * animation/rotation (the final state is set instantly), but the haptic
 * STILL fires — haptics aren't motion. Plays once; the "don't replay" logic
 * doesn't live here, it's in useCollectionStore.revealedIds (see the store).
 */
export function StickerReveal({ children, onFinish }: StickerRevealProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.9);
  const rotate = useSharedValue(0);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (reduceMotion) {
      const timeout = setTimeout(onFinish, 0);
      return () => clearTimeout(timeout);
    }

    scale.value = withTiming(1, { duration: 260 });
    rotate.value = withSequence(
      withTiming(3, { duration: 130 }),
      withTiming(-3, { duration: 130 }),
      withTiming(0, { duration: 130 }),
    );

    const timeout = setTimeout(onFinish, 260 + 390);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
