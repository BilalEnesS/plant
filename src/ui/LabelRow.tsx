import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/layout';
import { Body, Caption } from '@/ui/Text';

interface LabelRowProps {
  label: string;
  value: string;
  /** For the toxicity row — spec: signal is the one warning color, used in exactly one place on screen. */
  warn?: boolean;
}

/** A herbarium-label-style row: label on the left, value on the right, hairline underneath. */
export function LabelRow({ label, value, warn }: LabelRowProps) {
  return (
    <View style={styles.row}>
      <Caption color={warn ? colors.signal : colors.moss} style={styles.label}>
        {label}
      </Caption>
      <Body color={warn ? colors.signal : colors.ink} style={styles.value}>
        {value}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: spacing(4),
  },
  label: {
    width: 110,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
