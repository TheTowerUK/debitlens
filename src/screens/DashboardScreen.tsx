// src/screens/DashboardScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state, selectors, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Total balance across all accounts
  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + selectors.accountBalance(a.id), 0),
    [accounts, txs, selectors]
  );

  // Simple count of transactions this month
  const monthStats = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    let count = 0;
    let income = 0;
    let expense = 0;

    for (const t of txs) {
      const d = new Date(t.date);
      if (d.getFullYear() === y && d.getMonth() === m) {
        count++;
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
      }
    }
    return { count, income, expense };
  }, [txs]);

  const positive = totalBalance >= 0;

  const handleAddAccount = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a name for the account.');
      return;
    }
    try {
      // Your AppProvider already manages accounts in memory.
      // We assume addAccount accepts a name string; if it accepts an object,
      // you can tweak this line to match.
      await (actions as any).addAccount(name);
      setAdding(false);
      setNewName('');
    } catch (e: any) {
      console.warn('[dashboard] addAccount failed', e);
      Alert.alert('Error', e?.message || 'Could not create account');
    }
  };

  return (
    <View style={styles.wrap}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>DebitLens</Text>
          <Text style={styles.appSubtle}>Personal cash flow at a glance</Text>
        </View>
        <Pressable
          style={styles.settingsPill}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsPillText}>Settings</Text>
        </Pressable>
      </View>

      {/* SUMMARY CARD */}
      <View style={styles.summaryCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.summaryLabel}>Total balance</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: positive ? '#34D399' : '#F87171' },
              ]}
            >
              £{Math.abs(totalBalance).toFixed(2)}
            </Text>
            <Text style={styles.summaryHint}>
              {positive ? 'Net positive position' : 'Net negative position'}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryLabel}>This month</Text>
            <Text style={styles.summarySmall}>
              {monthStats.count} txns
            </Text>
            <Text style={styles.summarySmall}>
              +£{monthStats.income.toFixed(2)} / -£{monthStats.expense.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      {/* ACCOUNTS LIST */}
      <Text style={styles.sectionTitle}>Accounts</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {accounts.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySubtle}>
              Create your first account to start tracking money.
            </Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, { marginTop: 10 }]}
              onPress={() => setAdding(true)}
            >
              <Text style={styles.btnText}>Add account</Text>
            </Pressable>
          </View>
        )}

        {accounts.map((a) => {
          const bal = selectors.accountBalance(a.id);
          const accountTxs = selectors
            .transactionsForAccount(a.id)
            .slice()
            .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
          const lastTx = accountTxs[0] || null;
          const lastDate = lastTx?.date ? new Date(lastTx.date) : null;

          return (
            <Pressable
              key={String(a.id)}
              style={({ pressed }) => [
                styles.accountCard,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => navigation.navigate('Account', { accountId: a.id })}
            >
              <View style={styles.accountHeader}>
                <Text style={styles.accountName}>{a.name}</Text>
                <Text
                  style={[
                    styles.accountBalance,
                    { color: bal < 0 ? '#F87171' : '#34D399' },
                  ]}
                >
                  £{Math.abs(bal).toFixed(2)}
                </Text>
              </View>
              {lastTx ? (
                <Text style={styles.accountSub}>
                  {lastTx.note || 'Last transaction'} ·{' '}
                  {lastDate ? lastDate.toLocaleDateString() : ''}
                </Text>
              ) : (
                <Text style={styles.accountSubEmpty}>No transactions yet</Text>
              )}
            </Pressable>
          );
        })}

        {/* INLINE ADD ACCOUNT PANEL */}
        {adding && (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>New account</Text>
            <Text style={styles.addLabel}>Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Main Current, Savings, Holiday"
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
            <View style={styles.addRow}>
              <Pressable
                style={[styles.btn, styles.btnGhost, { flex: 1, marginRight: 6 }]}
                onPress={() => {
                  setAdding(false);
                  setNewName('');
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, { flex: 1, marginLeft: 6 }]}
                onPress={handleAddAccount}
              >
                <Text style={styles.btnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* QUICK ACTIONS PANEL (FLOATING AT BOTTOM) */}
      <View style={styles.quickActions}>
        <Text style={styles.quickTitle}>Quick actions</Text>
        <View style={styles.quickGrid}>
          <Pressable
            style={[styles.quickItem, styles.quickGhost]}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.quickLabel}>History</Text>
          </Pressable>
          <Pressable
            style={[styles.quickItem, styles.quickGhost]}
            onPress={() => navigation.navigate('Reports')}
          >
            <Text style={styles.quickLabel}>Reports</Text>
          </Pressable>
          <Pressable
            style={[styles.quickItem, styles.quickGhost]}
            onPress={() => navigation.navigate('Budgets')}
          >
            <Text style={styles.quickLabel}>Budgets</Text>
          </Pressable>
          <Pressable
            style={[styles.quickItem, styles.quickGhost]}
            onPress={() => navigation.navigate('ImportCSV')}
          >
            <Text style={styles.quickLabel}>Import CSV</Text>
          </Pressable>
          <Pressable
            style={[styles.quickItem, styles.quickPrimary]}
            onPress={() => setAdding(true)}
          >
            <Text style={styles.quickLabel}>Add account</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },

  // TOP BAR
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  appSubtle: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  settingsPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#020817',
  },
  settingsPillText: { color: '#E5E7EB', fontWeight: '600', fontSize: 13 },

  // SUMMARY
  summaryCard: {
    backgroundColor: '#0B1120',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  summaryLabel: { color: '#9CA3AF', fontSize: 13 },
  summaryValue: { fontSize: 28, fontWeight: '800', marginTop: 4 },
  summaryHint: { color: '#6B7280', marginTop: 4, fontSize: 12 },
  summaryRight: { alignItems: 'flex-end' },
  summarySmall: { color: '#E5E7EB', fontSize: 13, marginTop: 4 },

  // SECTION TITLE
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },

  scroll: { flex: 1 },

  // EMPTY STATE
  emptyBox: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 8,
  },
  emptyTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700' },
  emptySubtle: { color: '#9CA3AF', marginTop: 4 },

  // ACCOUNT CARD
  accountCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: { color: '#F9FAFB', fontSize: 16, fontWeight: '700' },
  accountBalance: { fontSize: 18, fontWeight: '800' },
  accountSub: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  accountSubEmpty: { color: '#6B7280', fontSize: 12, marginTop: 4 },

  // ADD ACCOUNT PANEL
  addCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  addTitle: { color: '#E5E7EB', fontWeight: '700', marginBottom: 8 },
  addLabel: { color: '#9CA3AF', marginBottom: 4, fontSize: 13 },
  input: {
    backgroundColor: '#020617',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    marginTop: 4,
  },

  // BUTTONS
  btn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnGhost: {
    backgroundColor: '#1F2937',
  },
  btnText: { color: '#fff', fontWeight: '700' },

  // QUICK ACTIONS
  quickActions: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 20 : 12,
    backgroundColor: '#020617',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  quickTitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 6,
    marginLeft: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  quickItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  quickGhost: {
    backgroundColor: '#0B1120',
  },
  quickPrimary: {
    backgroundColor: '#2563EB',
  },
  quickLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },
});
