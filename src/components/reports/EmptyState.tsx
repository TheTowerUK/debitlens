// src/components/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors as theme } from '../../theme/colors';

export function EmptyState(props: { title: string; body?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{props.title}</Text>
      {!!props.body && <Text style={styles.body}>{props.body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 14, fontWeight: '700' },
  body: { color: theme.textDim, marginTop: 6, fontSize: 12, lineHeight: 16 },
});
