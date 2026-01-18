import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, StyleProp, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors as theme } from '../theme/colors';

type Props = {
  /** Optional override label (default: "← Back") */
  label?: string;

  /** Optional override handler (if you want custom behaviour) */
  onPress?: () => void;

  /** Optional style overrides for the pill container */
  style?: StyleProp<ViewStyle>;

  /** Optional test id */
  testID?: string;
};

export default function BackPill({ label = '← Back', onPress, style, testID }: Props) {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    if (onPress) return onPress();

    if (navigation?.canGoBack?.() && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // Fallback (safe): do nothing rather than crash
    // If you prefer, replace with navigation.navigate('Dashboard')
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.pill,
        pressed && { opacity: Platform.OS === 'ios' ? 0.6 : 0.8 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(147, 197, 253, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.25)',
    marginBottom: 12,
  },
  pillText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
