// src/components/HeaderBackButton.tsx
import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors as theme } from '../theme/colors';

type Props = {
  /** Optional override label (default: "Back") */
  label?: string;
  /** Optional override handler */
  onPress?: () => void;
};

export default function HeaderBackButton({ label = 'Back', onPress }: Props) {
  const navigation = useNavigation<any>();

  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

  // If the caller provided an override handler, always show the button.
  // Otherwise, hide it when there's nowhere to go back to.
  if (!onPress && !canGoBack) return null;

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    navigation.goBack();
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.backButton,
        pressed && { opacity: Platform.OS === 'ios' ? 0.6 : 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    minWidth: 80,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: theme.link,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
