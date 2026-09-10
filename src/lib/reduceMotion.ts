import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when iOS Settings > Accessibility > Reduce Motion is on. Animations check this. */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
