import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, SectionList, TextInput } from 'react-native';
import { useApp } from '../state/AppState';
import { startEndForPreset, filterTxns } from '../utils/reports';

const PRESETS = [
  { key: 'THIS_MONTH', label: 'This Month' },
  { key: 'LAST_MONTH', label: 'Last Month' },
  { key: 'THIS_WEEK',  label: 'This Week'  },
];

const TYPE_TABS = ['all', 'income', 'expense'];

const fmtAmt = (n) => Number(n || 0).toFixed(2);
const dateKey = (iso) => iso.slice(0,10); // YYYY-MM-DD

export default function HistoryScreen({ navigation }) {
  const { state } = useApp();
  const [preset, setPreset]   = useState('THIS_MONTH');
  const [typeTab, setTypeTab] = useState('all');
  const [q, setQ]             = useState('');
  const [accountId, setAccountId] = useState(undefined);

  const { start, end } = useMemo(() => startEndForPreset(preset), [preset]);

  const filtered = useMemo(() => {
    let base = filterTxns(state.transactions ?? [], { dateStart: start, dateEnd: end, accountId });
    if (typeTab !== 'all') base = base.filter(t => t.type === typeTab);

    const query = q.trim().toLowerCase();
    if (query) {
      base = base.filter(t => {
        const hay = [
          t.category || '',
          t.note || '',
          t.accountName || '',
          String(t.amount)
        ].join(' ').toLowerCase();
        return hay.includes(query);
      });
    }
    // newest first
    return base.sort((a,b) => b.date.localeCompare(a.date));
  }, [state.transactions, start, end, accountId, typeTab, q]);

  const sections = useMemo(() => {
    const bucket = new Map();
    for (const t of filtered) {
      const key = dateKey(t.date);
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key).push(t);
    }
    const keys = Array.from(bucket.keys()).sort((a,b) => b.localeCompare(a)); // desc
    return keys.map(k => ({ title: k, data: bucket.get(k) }));
  }, [filtered]);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>History</Text>

            {/* Presets */}
            <View style={styles.row}>
              {PRESETS.map(p => (
                <Pressable key={p.key} onPress={() => setPreset(p.key)}
                  style={[styles.chip, preset === p.key && styles.chipActive]}>
                  <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Type tabs */}
            <View style={styles.row}>
              {TYPE_TABS.map(t => (
                <Pressable key={t} onPress={() => setTypeTab(t)}
                  style={[styles.pill, typeTab === t && styles.pillActive]}>
                  <Text style={[styles.pillText, typeTab === t && styles.pillTextActive]}>
                    {t[0].toUpperCase()+t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Account cycle + search */}
            <View style={styles.rowWrap}>
              <Pressable
                style={styles.accountBtn}
                onPress={() => {
                  const ids = (state.accounts ?? []).map(a => a.id);
                  if (!ids.length) return;
                  if (!accountId) { setAccountId(ids[0]); return; }
                  const idx = ids.indexOf(accountId);
                  setAccountId(idx === -1 || idx === ids.length - 1 ? undefined : ids[idx + 1]);
                }}>
                <Text style={styles.accountBtnText}>Account: {accountId ?? 'All'}</Text>
              </Pressable>

              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search (category, note, amount)…"
                style={styles.search}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.range}>
              {start.toISOString().slice(0,10)} → {end.toISOString().slice(0,10)} • {filtered.length} items
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            style={styles.rowItem}
            onPress={() => {
              // Optional: navigate to an edit/details screen if you have one
              // navigation.navigate('TransactionDetail', { id: item.id })
            }}
            onLongPress={() => {
              // TODO: wire to your AppState delete action if available
              // Example: dispatch({ type: 'DELETE_TXN', id: item.id })
              console.log('Long-pressed txn', item.id);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cat}>{item.category}{item.accountName ? ` • ${item.accountName}` : ''}</Text>
              {!!item.note && <Text style={styles.note} numberOfLines={1}>{item.note}</Text>}
            </View>
            <Text style={[styles.amount, item.type === 'expense' ? styles.red : styles.green]}>
              {item.type === 'expense' ? '-' : '+'}£{fmtAmt(item.amount)}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 6, flexWrap: 'wrap' },
  rowWrap: { flexDirection: 'row', gap: 8, marginVertical: 6, alignItems: 'center' },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: '#ddd' },
  chipActive: { backgroundColor: '#111', borderColor: '#111' },
  chipText: { color: '#111' },
  chipTextActive: { color: 'white' },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6' },
  pillActive: { backgroundColor: '#111' },
  pillText: { color: '#111' },
  pillTextActive: { color: '#fff' },
  accountBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3F4F6' },
  accountBtnText: { fontSize: 13 },
  search: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  range: { color: '#6B7280', marginTop: 4 },
  sectionHeader: { backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  sectionTitle: { fontWeight: '700', color: '#374151' },
  rowItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white' },
  cat: { fontSize: 14, color: '#111827', fontWeight: '600' },
  note: { fontSize: 12, color: '#6B7280', marginTop: 2, maxWidth: 200 },
  amount: { width: 120, textAlign: 'right', fontWeight: '700' },
  red: { color: '#DC2626' },
  green: { color: '#16A34A' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB' },
});
