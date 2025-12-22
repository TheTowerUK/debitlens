// src/screens/DashboardScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
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
  const budgets = state.budgets || [];

  // ---- Month range (used by monthSummary + budgets) ----
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }, []);

  const formatMoney = (v: number) => `£${(Number(v) || 0).toFixed(2)}`;

  // ---- Account balances (include opening balance + tx deltas) ----
  const { totalBalance, accountCount, balanceById } = useMemo(() => {
    const map: Record<string, number> = {};

    // Start with opening balances
    for (const acc of accounts) {
      if (!acc?.id) continue;
      map[acc.id] = Number(acc.balance) || 0;
    }

    // Apply transaction deltas
    for (const t of txs) {
      const id = t?.accountId;
      if (!id) continue;

      const amt = Number(t.amount) || 0;
      if (map[id] === undefined) map[id] = 0;

      if (t.type === 'income') map[id] += amt;
      else if (t.type === 'expense') map[id] -= amt;
      // transfer handling can be added later if you model it as paired txs
    }

    const total = Object.values(map).reduce((sum, v) => sum + (Number(v) || 0), 0);

    return {
      balanceById: map,
      totalBalance: total,
      accountCount: accounts.length,
    };
  }, [accounts, txs]);

  // ---- This month summary ----
  const monthSummary = useMemo(() => {
    const { start, end } = monthRange;

    let income = 0;
    let expense = 0;

    for (const t of txs) {
      if (!t?.date) continue;
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
  }, [txs, monthRange]);

  const monthNetColor =
    monthSummary.net >= 0 ? styles.positiveText : styles.negativeText;

  // ---- Budgets summary (this month) ----
  const spentByCategory = useMemo(() => {
    const { start, end } = monthRange;
    const map: Record<string, number> = {};

    for (const t of txs) {
      if (!t?.date) continue;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) continue;
      if (d < start || d >= end) continue;

      if (t.type !== 'expense') continue;

      const cat = (t.category || 'Uncategorised').trim();
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount) || 0);
    }

    return map;
  }, [txs, monthRange]);

  const budgetSummary = useMemo(() => {
    const list = budgets ?? [];
    if (list.length === 0) return { exceeded: 0, warning: 0, totalRemaining: 0 };

    let exceeded = 0;
    let warning = 0;
    let totalRemaining = 0;

    for (const b of list) {
      const limit = Number(b.limit) || 0;
      if (limit <= 0) continue;

      const cat = (b.category || '').trim();
      const spent = spentByCategory[cat] || 0;

      const remaining = limit - spent;
      totalRemaining += remaining;

      if (spent >= limit) exceeded++;
      else if (spent >= limit * 0.8) warning++;
    }

    return { exceeded, warning, totalRemaining };
  }, [budgets, spentByCategory]);

  // ---- Upcoming recurring (next 30 days) ----
  const upcomingRecurringAll = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 30);

    return recurring
      .filter((r) => r.active !== false && r.nextDueDate)
      .map((r) => {
        const d = r.nextDueDate ? new Date(r.nextDueDate) : null;
        if (!d || isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return { item: r, date: d };
      })
      .filter((x): x is { item: RecurringItem; date: Date } => !!x)
      .filter(({ date }) => date >= today && date <= horizon)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [recurring]);

  const upcomingTop = useMemo(
    () => upcomingRecurringAll.slice(0, 5),
    [upcomingRecurringAll]
  );
  const hasMoreUpcoming = upcomingRecurringAll.length > 5;

  // ---- Logout handler: back to Login (PIN) ----
  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

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
              hitSlop={8}
            >
              <Text style={styles.headerPillText}>Settings</Text>
            </Pressable>

            <Pressable
              style={[styles.headerPill, styles.logoutPill]}
              onPress={handleLogout}
              hitSlop={8}
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
                In: {formatMoney(monthSummary.income)} · Out: {formatMoney(monthSummary.expense)}
              </Text>
            </View>
          </View>
        </View>

        {/* ---------- Upcoming Recurring ---------- */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Upcoming (next 30 days)</Text>
            <Pressable onPress={() => navigation.navigate('Recurring')} hitSlop={8}>
              <Text style={styles.cardLink}>Manage</Text>
            </Pressable>
          </View>

          {upcomingTop.length === 0 ? (
            <Text style={styles.subtle}>
              No active recurring items due in the next 30 days.
            </Text>
          ) : (
            <>
              {upcomingTop.map(({ item, date }) => (
                <View key={item.id} style={styles.upcomingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingTitle}>
                      {item.title ||
                        (item.isTransfer ? 'Recurring transfer' : 'Recurring item')}
                    </Text>
                    <Text style={styles.upcomingSub}>
                      {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)} ·{' '}
                      {date.toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.upcomingAmount}>
                    {formatMoney(Number(item.amount || 0))}
                  </Text>
                </View>
              ))}

              {hasMoreUpcoming ? (
                <Pressable onPress={() => navigation.navigate('Recurring')} hitSlop={8}>
                  <Text style={[styles.cardLink, { marginTop: 10 }]}>See all upcoming</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>

        {/* ---------- Accounts list (Dashboard) ---------- */}
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
                  hitSlop={6}
                >
            <View style={{ flex: 1 }}>
              <Text style={styles.accountName}>{a.name || 'Account'}</Text>

            <Text style={styles.accountMeta}>
              {String(a.type || 'account').toUpperCase()}
              <Text style={styles.accountMetaDim}> · Opening: {formatMoney(Number(a.balance || 0))}</Text>
            </Text>

            </View>

            <Text style={styles.accountBalance}>
              {formatMoney(balanceById[a.id] ?? 0)}
            </Text>

            <Text style={styles.accountChevron}>›</Text>

                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ---------- Navigation Grid ---------- */}
        <View style={styles.grid}>
          {/* Payments */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Payments')}
              hitSlop={6}
            >
              <Text style={styles.gridTitle}>Payments</Text>
              <Text style={styles.gridSub}>Browse and edit transactions</Text>
            </Pressable>
          </View>

          {/* Recurring */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Recurring')}
              hitSlop={6}
            >
              <Text style={styles.gridTitle}>Recurring</Text>
              <Text style={styles.gridSub}>Direct debits & standing orders</Text>
            </Pressable>
          </View>

          {/* Budgets */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Budgets')}
              hitSlop={6}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={styles.gridTitle}>Budgets</Text>

                {budgetSummary.exceeded > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{budgetSummary.exceeded}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.gridSub}>
                {budgets.length === 0
                  ? 'No budgets set yet'
                  : `${budgetSummary.warning} near limit • Remaining ${Math.round(
                      budgetSummary.totalRemaining
                    )}`}
              </Text>
            </Pressable>
          </View>

          {/* Reports / Notifications */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Reports')}
              hitSlop={6}
            >
              <Text style={styles.gridTitle}>Reports</Text>
              <Text style={styles.gridSub}>See trends & breakdowns</Text>
            </Pressable>

            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('Notifications')}
              hitSlop={6}
            >
              <Text style={styles.gridTitle}>Notifications</Text>
              <Text style={styles.gridSub}>Alerts & reminders</Text>
            </Pressable>
          </View>

          {/* Data export/import */}
          <View style={styles.gridRow}>
            <Pressable
              style={styles.gridCard}
              onPress={() => navigation.navigate('DataExportImport')}
              hitSlop={6}
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
    paddingTop: 35,
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

  // CARD
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

  // ACCOUNTS
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
  accountMetaDim: { opacity: 0.8 },

  accountBalance: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginRight: 6,
  },
  accountChevron: {
    color: '#93C5FD',
    fontSize: 22,
    paddingLeft: 6,
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
    borderRadius: 14,
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

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B91C1C',
  },
  badgeText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 12,
  },
});
