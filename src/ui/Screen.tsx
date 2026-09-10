import { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

interface ScreenProps extends PropsWithChildren {
  style?: ViewStyle;
  /** For full-screen, dark-chrome screens like the camera. */
  dark?: boolean;
  /** A plain View instead of SafeAreaView — modals already have an outer SafeAreaView. */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export function Screen({ children, style, dark = false, edges }: ScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.base, { backgroundColor: dark ? colors.ink : colors.paper }, style]}
    >
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
