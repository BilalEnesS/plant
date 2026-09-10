import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { Caption, Micro } from '@/ui/Text';
import { useCopy } from '@/copy/useCopy';
import type { ConfidenceBand } from '@/services/types';

interface ConfidenceIndicatorProps {
  band: ConfidenceBand;
  downgraded?: boolean;
}

const SEGMENTS_LIT: Record<ConfidenceBand, number> = { high: 3, medium: 2, low: 1 };

/**
 * NOT a percentage bar — a labelled status badge + 3-segment bar. This is
 * where the spec's "uncertainty isn't hidden behind a percentage, but also
 * shouldn't read like an exact number" principle takes concrete form.
 *
 * The badge carries the words because the species name no longer does. The
 * title used to read "Most likely <name>", which both weakened the name and
 * duplicated what this component already says; the hedge now lives here
 * alone, where it is stated once and read clearly.
 *
 * It reports HOW confident the app is, never WHY. Which services produced
 * the identification, and whether any particular one confirmed it, are
 * implementation details the user never sees (see the plan's transparency
 * decision) — the band alone carries the uncertainty.
 */
export function ConfidenceIndicator({ band, downgraded }: ConfidenceIndicatorProps) {
  const tr = useCopy();

  const isPositive = band === 'high';
  const accent = isPositive ? colors.moss : colors.signal;
  const tint = isPositive ? colors.mossTint : colors.signalTint;

  const label =
    band === 'high' ? tr.confidenceHigh : band === 'medium' ? tr.confidenceMedium : tr.confidenceLow;

  const lit = SEGMENTS_LIT[band];

  return (
    <View style={styles.container}>
      <View
        accessible
        accessibilityLabel={label}
        style={[styles.badge, { backgroundColor: tint }]}
      >
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Caption color={accent} style={styles.label}>
          {label}
        </Caption>
        <View style={styles.segments}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.segment, { backgroundColor: i < lit ? accent : colors.hairline }]}
            />
          ))}
        </View>
      </View>

      {downgraded && <Micro color={colors.signal}>{tr.visualDisagreement}</Micro>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing(2),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    alignSelf: 'flex-start',
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radius.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: 13,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing(1),
    marginLeft: spacing(1),
  },
  segment: {
    width: 16,
    height: 3,
    borderRadius: radius.pill,
  },
});
