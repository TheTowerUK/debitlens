// src/screens/DashboardScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state, actions } = useApp();

  const accounts = state.accounts || [];
  const allTxs = state.transactions || [];

  // Add-account UI
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Total balance (all accounts)
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => {
      const accTxs = allTxs.filter(t => t.accountId === a.id);
      const bal = accTxs.reduce((sub, t) => {
        return sub + (t.type === 'income' ? t.amount : -t.amount);
      }, 0);
      return sum + bal;
    }, 0);
  }, [accounts, allTxs]);

  const positiveTrend = totalBalance >= 0;

  const handleAddAccount = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const account = actions.addAccount(trimmed);
    setAdding(false);
    setNewName('');
    navigation.navigate('Account', { accountId: account.id });
  };

  return (
    <View style={styles.wrap}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Total Balance</Text>
          <Text style={styles.total}>
            £{Math.abs(totalBalance).toFixed(2)}
          </Text>
        </View>
        <Text style={[styles.trend, positiveTrend ? styles.trendUp : styles.trendDown]}>
          {positiveTrend ? '▲ Up' : '▼ Down'}
        </Text>
      </View>

      {/* ACCOUNTS + ADD ACCOUNT */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {accounts.length === 0 && !adding && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySubtle}>
              Create your first account to start tracking transactions.
            </Text>
            <Pressable
              style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
              onPress={() => setAdding(true)}
            >
              <Text style={styles.btnText}>Add account</Text>
            </Pressable>
          </View>
        )}

        {accounts.map(a => {
          const accTxs = allTxs.filter(t => t.accountId === a.id);

          const bal = accTxs.reduce((sum, t) => {
            return sum + (t.type === 'income' ? t.amount : -t.amount);
          }, 0);

          const sorted = [...accTxs].sort((x, y) =>
            (y.date || '').localeCompare(x.date || '')
          );
          const lastTx = sorted[0] || null;
          const lastDate = lastTx?.date
            ? new Date(`${lastTx.date}T00:00:00`)
            : null;

          return (
            <Pressable
              key={String(a.id)}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => navigation.navigate('Account', { accountId: a.id })}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{a.name}</Text>
                <Text
                  style={[
                    styles.cardBalance,
                    bal < 0 ? styles.cardBalanceNeg : styles.cardBalancePos,
                  ]}
                >
                  £{Math.abs(bal).toFixed(2)}
                </Text>
              </View>

              {lastTx ? (
                <Text style={styles.lastTx}>
                  {/* Main label: note if present, otherwise Income/Expense */}
                  {lastTx.note
                    ? lastTx.note
                    : lastTx.type === 'income'
                    ? 'Income'
                    : 'Expense'}

                  {/* Optional date, as a nested Text */}
                  {lastDate && (
                    <Text style={styles.lastTx}>
                      {' · '}
                      {lastDate.toLocaleDateString()}
                    </Text>
                  )}
                </Text>
              ) : (
                <Text style={styles.lastTxEmpty}>No transactions yet</Text>
              )}

            </Pressable>
          );
        })}

        {/* ADD ACCOUNT INLINE FORM */}
        {adding && (
          <View style={styles.addBox}>
            <Text style={styles.addLabel}>New Account Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Holiday Fund"
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
            <View style={styles.addRow}>
              <Pressable
                style={[styles.btn, styles.btnGhost]}
                onPress={() => {
                  setAdding(false);
                  setNewName('');
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleAddAccount}
              >
                <Text style={styles.btnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!adding && accounts.length > 0 && (
          <Pressable
            style={[styles.btn, styles.btnGhost, { marginTop: 8 }]}
            onPress={() => setAdding(true)}
          >
            <Text style={styles.btnText}>Add another account</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* FLOATING ADD TRANSACTION BUTTON */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('TxnEditor')}
      >
        <Text style={styles.fabText}>+ Transaction</Text>
      </Pressable>

      {/* FOOTER NAV MENU */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.footerText}>Dashboard</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.footerText}>History</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Budgets')}
        >
          <Text style={styles.footerText}>Budgets</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.footerText}>Settings</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('ImportCSV')}
        >
          <Text style={styles.footerText}>Import CSV</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  total: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  trend: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendUp: {
    color: '#4ADE80',
  },
  trendDown: {
    color: '#F97373',
  },
  scroll: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 70, // a bit above footer so they don’t overlap
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#2563EB',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  fabText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 14,
  },
  // Account cards
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
  },
  cardBalance: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardBalancePos: {
    color: '#4ADE80',
  },
  cardBalanceNeg: {
    color: '#F97373',
  },
  lastTx: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 6,
  },
  lastTxEmpty: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 6,
  },

  // Add account box
  addBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  addLabel: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  addRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  // Buttons
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnGhost: {
    backgroundColor: '#1F2937',
  },
  btnText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },

  // Empty state
  emptyCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  emptySubtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },

  // Footer nav
  footer: {
    borderTopWidth: 1,
    borderColor: '#111827',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 16 : 10,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  footerBtnGhost: {
    backgroundColor: '#020617',
  },
  footerText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 13,
  },
});
