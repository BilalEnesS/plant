import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radius } from '@/theme/layout';
import { Body, Latin } from '@/ui/Text';
import type { Candidate } from '@/services/types';

interface CandidateListProps {
  candidates: Candidate[];
  onSelect: (candidate: Candidate) => void;
}

/**
 * Only shown at medium/low confidence (result.tsx renders it conditionally).
 * Tapping swaps it with the main candidate in LOCAL state only — doesn't
 * rewrite the DB row or re-run enrichment.
 */
export function CandidateList({ candidates, onSelect }: CandidateListProps) {
  if (candidates.length === 0) return null;

  return (
    <View style={styles.container}>
      {candidates.map((c) => (
        <Pressable
          key={c.latin}
          onPress={() => onSelect(c)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Latin style={styles.latin}>{c.latin}</Latin>
          {c.commonNames[0] && <Body color={colors.moss}>{c.commonNames[0]}</Body>}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: {
    backgroundColor: colors.hairline,
  },
  latin: {
    fontSize: 14,
  },
});
