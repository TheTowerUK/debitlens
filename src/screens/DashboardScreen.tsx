// src/screens/DashboardScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useApp, type RecurringItem } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];
  const recurring: RecurringItem[] = state.recurring || [];

  // ---- Account balances (derived from transactions) ----
  const { totalBalance, accountCount } = useMemo(() => {
    const balanceById: Record<string, number> = {};

    for (const acc of accounts) {
      if (acc && acc.id) {
        balanceById[acc.id] = 0;
      }
    }

    for (const t of txs) {
      const id = t.accountId;
      if (!id) continue;
      const amt = Number(t.amount) || 0;
      if (!balanceById.hasOwnProperty(id)) {
        balanceById[id] = 0;
      }

      if (t.type === 'income') {
        balanceById[id] += amt;
      } else if (t.type === 'expense') {
        balanceById[id] -= amt;
      }
    }

    const total = Object.values(balanceById).reduce((sum, v) => sum + v, 0);

    return {
      totalBalance: total,
      accountCount: accounts.length,
    };
  }, [accounts, txs]);

  // ---- This month summary ----
  const monthSummary = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let income = 0;
    let expense = 0;

    for (const t of txs) {
      if (!t.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
    }

    return {
      income,
      expense,
      net: income - expense,
    };
  }, [txs]);

  // ---- Upcoming recurring (next 30 days) ----
  const upcomingRecurring = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 30);

    const items = recurring
      .filter((r) => r.active !== false && r.nextDueDate)
      .map((r) => {
        const d = r.nextDueDate ? new Date(r.nextDueDate) : null;
        if (!d || isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return { item: r, date: d };
      })
      .filter((x): x is { item: RecurringItem; date: Date } => !!x)
      .filter(({ date }) => date >= today && date <= horizon)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 3);

    return items;
  }, [recurring]);

  // ---- Logout handler: back to Login (PIN) ----
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const formatMoney = (v: number) => `£${v.toFixed(2)}`;

  const monthNetColor =
    monthSummary.net >= 0 ? styles.positiveText : styles.negativeText;

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* ---------- Header with SETTINGS + LOGOUT ---------- */}
        <View style={styles.headerRow}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.h1}>Dashboard</Text>
            <Text style={styles.subtle}>
              Quick view of balances, activity & upcoming payments
            </Text>
          </View>

          <View style={styles.headerPillsRow}>
            <Pressable
              style={styles.headerPill}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.headerPillText}>Settings</Text>
            </Pressable>

            <Pressable
              style={[styles.headerPill, styles.logoutPill]}
              onPress={handleLogout}
            >
              <Text style={styles.headerPillText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        {/* ---------- Summary Card ---------- */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Overview</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total balance</Text>
              <Text style={styles.summaryValue}>{formatMoney(totalBalance)}</Text>
              <Text style={styles.summarySub}>
                Across {accountCount} account{accountCount === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>This month</Text>
              <Text style={[styles.summaryValue, monthNetColor]}>
                {monthSummary.net >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(monthSummary.net))}
              </Text>
              <Text style={styles.summarySub}>
                In: {formatMoney(monthSummary.income)} · Out:{' '}
                {formatMoney(monthSummary.expense)}
              </Text>
            </View>
          </View>
        </View>

        {/* ---------- Upcoming Recurring ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Upcoming (next 30 days)</Text>
            <Pressable onPress={() => navigation.navigate('Recurring')}>
              <Text style={styles.cardLink}>Manage</Text>
            </Pressable>
          </View>

          {upcomingRecurring.length === 0 ? (
            <Text style={styles.subtle}>
              No active recurring items due in the next 30 days.
            </Text>
          ) : (
            upcomingRecurring.map(({ item, date }) => (
              <View key={item.id} style={styles.upcomingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upcomingTitle}>
                    {item.title ||
                      (item.isTransfer ? 'Recurring transfer' : 'Recurring item')}
                  </Text>
                  <Text style={styles.upcomingSub}>
                    {item.frequency.charAt(0).toUpperCase() +
                      item.frequency.slice(1)}{' '}
                    · {date.toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.upcomingAmount}>
                  £{Number(item.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ---------- Navigation Grid ---------- */}
        <View style={styles.grid}>
          {/* Accounts / Payments */}
        {/* Accounts list (Dashboard) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Your accounts</Text>

            <Pressable
              style={styles.smallBtn}
              onPress={() => navigation.navigate('AddAccount')}
              hitSlop={8}
            >
              <Text style={styles.smallBtnText}>Add</Text>
            </Pressable>
          </View>

          {accounts.length === 0 ? (
            <Text style={styles.emptyText}>No accounts yet.</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {accounts.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.accountRow}
                  onPress={() => navigation.navigate('Account', { accountId: a.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.accountName}>{a.name || 'Account'}</Text>
                    <Text style={styles.accountMeta}>
                      {String(a.type || 'account').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.accountChevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

          <View style={styles.gridRow}>


            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Payments')}
            >
              <Text style={styles.gridTitle}>Payments</Text>
              <Text style={styles.gridSub}>Browse and edit transactions</Text>
            </Pressable>
          </View>
          
          {/* Recurring / Budgets */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Recurring')}
            >
              <Text style={styles.gridTitle}>Recurring</Text>
              <Text style={styles.gridSub}>Direct debits & standing orders</Text>
            </Pressable>

            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Budgets')}
            >
              <Text style={styles.gridTitle}>Budgets</Text>
              <Text style={styles.gridSub}>Plan spending by category</Text>
            </Pressable>
          </View>

          {/* Reports / Notifications */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Reports')}
            >
              <Text style={styles.gridTitle}>Reports</Text>
              <Text style={styles.gridSub}>See trends & breakdowns</Text>
            </Pressable>

            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Text style={styles.gridTitle}>Notifications</Text>
              <Text style={styles.gridSub}>Alerts & reminders</Text>
            </Pressable>
          </View>

          {/* Data export/import */}
          <View style={styles.gridRow}>
            <Pressable
              style={[styles.gridCard, { flex: 1 }]}
              onPress={() => navigation.navigate('DataExportImport')}
            >
              <Text style={styles.gridTitle}>Data export / import</Text>
              <Text style={styles.gridSub}>Backups, CSV import & export</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    flex: 1,
    backgroundColor: '#050816',
  },
  wrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    // a bit of extra top space on iOS to sit comfortably below status bar
    paddingTop: Platform.OS === 'ios' ? 8 : 8,
    paddingBottom: 32,
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  h1: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  subtle: {
    color: '#9CA3AF',
    marginTop: 4,
  },
  headerPillsRow: {
    flexDirection: 'row',
    columnGap: 8,
  },
  headerPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
  },
  logoutPill: {
    borderColor: '#F97373',
  },
  headerPillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },

  // SUMMARY CARD
  summaryCard: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  summaryTitle: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    columnGap: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  summarySub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  positiveText: {
    color: '#22C55E',
  },
  negativeText: {
    color: '#F97373',
  },

  // CARD (for upcoming)
  card: {
    backgroundColor: '#0B1020',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardLink: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
  },

  // UPCOMING ROWS
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    marginTop: 4,
  },
  upcomingTitle: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
  upcomingSub: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  upcomingAmount: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginLeft: 8,
  },

  // GRID
  grid: {
    marginTop: 4,
  },
  gridRow: {
    flexDirection: 'row',
    columnGap: 10,
    marginBottom: 10,
  },
  gridCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  gridTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: 4,
  },
  gridSub: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  smallBtnText: {
    color: '#BFDBFE',
    fontWeight: '700',
  },

  emptyText: {
    color: '#9CA3AF',
    marginTop: 10,
  },

  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
  },
  accountName: {
    color: '#F9FAFB',
    fontWeight: '800',
  },
  accountMeta: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  accountChevron: {
    color: '#93C5FD',
    fontSize: 22,
    paddingLeft: 10,
  },

});
