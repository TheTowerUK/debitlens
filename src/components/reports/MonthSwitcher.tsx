// src/components/MonthSwitcher.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { addMonths, formatMonthLabel } from '../../utils/reporting';

type Props = {
  monthKey: string; // YYYY-MM
  onChange: (nextMonthKey: string) => void;
  disabled?: boolean;
};

export default function MonthSwitcher({ monthKey, onChange, disabled }: Props) {
  const prev = () => onChange(addMonths(monthKey, -1));
  const next = () => onChange(addMonths(monthKey, 1));

  return (
    <View style={styles.row}>
      <Pressable
        onPress={prev}
        disabled={disabled}
        style={[styles.btn, disabled && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>◀</Text>
      </Pressable>

      <Text style={styles.label}>{formatMonthLabel(monthKey)}</Text>

      <Pressable
        onPress={next}
        disabled={disabled}
        style={[styles.btn, disabled && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>▶</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  label: { fontSize: 16, fontWeight: '600' },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: '700' },
});
