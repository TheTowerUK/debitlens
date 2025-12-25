// src/reports/components/MonthSwitcher.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { addMonths, monthKeyFromDate } from '../../hooks/reports/useReportRange';

export function MonthSwitcher({
  visible,
  monthKey,
  onChange,
  styles,
}: {
  visible: boolean;
  monthKey: string;
  onChange: (nextMonthKey: string) => void;
  styles: any;
}) {
  if (!visible) return null;

  return (
    <View style={styles.headerPillsRow}>
      <Pressable style={styles.headerPill} onPress={() => onChange(addMonths(monthKey, -1))}>
        <Text style={styles.headerPillText}>◀ Prev</Text>
      </Pressable>

      <Pressable style={styles.headerPill} onPress={() => onChange(monthKeyFromDate(new Date()))}>
        <Text style={styles.headerPillText}>This month</Text>
      </Pressable>

      <Pressable style={styles.headerPill} onPress={() => onChange(addMonths(monthKey, 1))}>
        <Text style={styles.headerPillText}>Next ▶</Text>
      </Pressable>
    </View>
  );
}
