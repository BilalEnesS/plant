import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';

interface LeafMarkProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * Plantie's leaf mark — a simplified version of the drop/leaf shape in the
 * brand logo. No extra asset or SVG dependency: it's a square with one
 * sharp and three rounded corners, rotated 45° (react-native-svg was left
 * out to preserve Expo Go compatibility).
 */
export function LeafMark({ size = 24, color = colors.lichen, style }: LeafMarkProps) {
  return (
    <View
      style={[
        styles.leaf,
        {
          width: size,
          height: size,
          backgroundColor: color,
          borderTopRightRadius: size * 0.55,
          borderBottomLeftRadius: size * 0.55,
          borderBottomRightRadius: size * 0.55,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  leaf: {
    borderTopLeftRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
