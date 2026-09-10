import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamily, fontSize } from '@/theme/type';
import { radius, spacing, TOUCH_MIN } from '@/theme/layout';
import { Body } from '@/ui/Text';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * primary   — bloom fill. At most ONE primary on screen at a time (spec:
 *             bloom shows in at most one place).
 * secondary — moss border, transparent fill.
 * ghost     — no border, for secondary actions.
 * All variants have a ≥44pt touch target.
 */
export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.paper : colors.moss} />
      ) : (
        <Body
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'ghost' && styles.ghostLabel,
          ]}
        >
          {label}
        </Body>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN,
    paddingHorizontal: spacing(5),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.bloom,
  },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.moss,
    backgroundColor: 'transparent',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.body,
  },
  primaryLabel: {
    color: colors.paper,
  },
  secondaryLabel: {
    color: colors.moss,
  },
  ghostLabel: {
    color: colors.ink,
  },
});
