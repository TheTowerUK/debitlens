// src/screens/PaymentsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Payments'>;

type FilterMode = 'all' | 'income' | 'expense';

function formatGBP(n: number) {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);
  } catch {
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    return `${sign}£${abs.toFixed(2)}`;
  }
}

function parseISODate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date) {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prettyDateHeading(d: Date) {
  // Simple: "Mon 23 Dec 2025"
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export default function PaymentsScreen({ navigation }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const accountNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.name || 'Account';
    return map;
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return txs
      .filter((t) => {
        if (filterMode !== 'all' && t.type !== filterMode) return false;
        if (!q) return true;

        const haystack = [
          t.name,
          t.description,
          t.category,
          accountNameById[t.accountId],
          t.type,
          t.date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(q);
      })
      .map((t) => {
        const d = parseISODate(t.date) || new Date(0);
        return { t, d };
      })
      .sort((a, b) => b.d.getTime() - a.d.getTime());
  }, [txs, query, filterMode, accountNameById]);

  const grouped = useMemo(() => {
    const groups: Record<string, { date: Date; items: typeof filtered }> = {};

    for (const item of filtered) {
      const key = dateKey(item.d);
      if (!groups[key]) groups[key] = { date: item.d, items: [] };
      groups[key].items.push(item);
    }

    const keys = Object.keys(groups).sort((a, b) => (a > b ? -1 : 1));
    return keys.map((k) => groups[k]);
  }, [filtered]);

  const onAdd = () => {
    // ✅ Adjust if your add screen route is different (e.g. 'PaymentForm')
    navigation.navigate('TxnEditor');
  };

  const onOpen = (id: string) => {
    // ✅ Adjust if your editor screen route differs
    navigation.navigate('TxnEditor', { id });

  };

  const onDelete = (id: string) => {
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => actions.deleteTransaction(id),
      },
    ]);
  };

  // Set header with Add button on left (Back button stays on right from brandHeaderOptions)
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Pressable onPress={onAdd} hitSlop={8} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>+ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation, onAdd]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {/* Subtitle */}
        <View style={styles.subtitleRow}>
          <Text style={styles.subtle}>Browse, search and edit transactions</Text>
        </View>

        {/* Search */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Search</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, category, description, account…"
            placeholderTextColor="#6B7280"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Filter pills */}
          <View style={{ flexDirection: 'row', columnGap: 8, marginTop: 10 }}>
            <Pressable
              style={[styles.pill, filterMode === 'all' && styles.pillActive]}
              onPress={() => setFilterMode('all')}
            >
              <Text style={[styles.pillText, filterMode === 'all' && styles.pillTextActive]}>
                All
              </Text>
            </Pressable>

            <Pressable
              style={[styles.pill, filterMode === 'income' && styles.pillActive]}
              onPress={() => setFilterMode('income')}
            >
              <Text style={[styles.pillText, filterMode === 'income' && styles.pillTextActive]}>
                Income
              </Text>
            </Pressable>

            <Pressable
              style={[styles.pill, filterMode === 'expense' && styles.pillActive]}
              onPress={() => setFilterMode('expense')}
            >
              <Text style={[styles.pillText, filterMode === 'expense' && styles.pillTextActive]}>
                Expense
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.subtle, { marginTop: 10 }]}>
            Showing {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* List */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Transactions</Text>
          </View>

          {filtered.length === 0 ? (
            <View style={{ paddingVertical: 8 }}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySub}>
                Try a different search, or add your first transaction.
              </Text>

              <Pressable style={[styles.headerPill, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={onAdd}>
                <Text style={styles.headerPillText}>+ Add payment</Text>
              </Pressable>
            </View>
          ) : (
            grouped.map((g) => (
              <View key={dateKey(g.date)} style={{ marginTop: 10 }}>
                <Text style={styles.groupHeading}>{prettyDateHeading(g.date)}</Text>

                {g.items.map(({ t }) => (
                  <Pressable
                    key={t.id}
                    style={styles.txRow}
                    onPress={() => onOpen(t.id)}
                    onLongPress={() => onDelete(t.id)}
                    hitSlop={6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {t.name || t.category || 'Transaction'}
                      </Text>
                      <Text style={styles.txMeta} numberOfLines={1}>
                        {accountNameById[t.accountId] || 'Account'}
                        {t.category ? ` • ${t.category}` : ''}
                        {t.description ? ` • ${t.description}` : ''}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, t.type === 'income' ? styles.positiveText : styles.negativeText]}>
                        {t.type === 'income' ? '+' : '-'}
                        {formatGBP(Math.abs(Number(t.amount) || 0))}
                      </Text>
                      <Text style={styles.chevron}>›</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  wrap: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  subtitleRow: {
    marginBottom: 10,
  },
  subtle: { color: theme.textDim, marginTop: 4 },

  headerPillsRow: { flexDirection: 'row', columnGap: 8, marginBottom: 14 },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: theme.card,
  },
  headerPillText: { color: '#E5E7EB', fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  searchInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
  },

  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  pillActive: {
    borderColor: theme.link,
  },
  pillText: { color: '#E5E7EB', fontWeight: '700', fontSize: 13 },
  pillTextActive: { color: theme.pillText },

  groupHeading: {
    color: '#E5E7EB',
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 4,
  },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  txTitle: { color: theme.text, fontWeight: '800' },
  txMeta: { color: theme.textDim, fontSize: 12, marginTop: 2 },

  txAmount: { fontWeight: '800' },
  positiveText: { color: theme.positive },
  negativeText: { color: theme.negative },

  chevron: { color: theme.link, fontSize: 22, marginTop: 2 },

  emptyTitle: { color: theme.text, fontWeight: '900', fontSize: 16, marginTop: 4 },
  emptySub: { color: theme.textDim, marginTop: 6 },
});
