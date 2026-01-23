// src/screens/DashboardScreen.tsx
import React, { useMemo, useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,  
} from 'react-native';
import { useApp, type RecurringItem } from '../state/AppContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { colors as theme } from '../theme/colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUpcomingOccurrences } from '../utils/recurring';
import { getOccurrenceDisplay, type AccountLite } from '../utils/occurrenceDisplay';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];
  const recurring: RecurringItem[] = state.recurring || [];
  const budgets = state.budgets || [];

  // Build account lookup map (lightweight for display)
  const accountById = useMemo(() => {
    const m: Record<string, AccountLite> = {};
    for (const a of accounts) m[a.id] = { id: a.id, name: a.name };
    return m;
  }, [accounts]);

  // ---- Month range (used by monthSummary + budgets) ----
  const monthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }, []);

  const formatMoney = (v: number) => `£${(Number(v) || 0).toFixed(2)}`;

  // UK date formatter for consistent date display
  const formatDate = useCallback((d: Date) => d.toLocaleDateString('en-GB'), []);

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

  // ---- Forecast (next 30 days) ----
  const forecast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current net worth and debt
    const currentNetWorth = totalBalance;
    const currentDebt = Math.abs(
      Object.values(balanceById).reduce((sum, bal) => sum + (bal < 0 ? bal : 0), 0)
    );

    // Get upcoming occurrences
    const upcoming = getUpcomingOccurrences(recurring, today, 30);

    // Clone balance map for forecast
    const forecastBalances = { ...balanceById };

    // Find non-archived accounts
    const nonArchivedAccounts = accounts.filter((a) => !a.archived);
    const singleAccount = nonArchivedAccounts.length === 1 ? nonArchivedAccounts[0] : null;

    let unassignedCount = 0;

    // Apply upcoming occurrences to forecast balances
    for (const occ of upcoming) {
      const amt = Number(occ.amount) || 0;

      if (occ.type === 'expense') {
        let targetAccountId = occ.accountId;

        // If no accountId and exactly one non-archived account, assign to it
        if (!targetAccountId && singleAccount) {
          targetAccountId = singleAccount.id;
        }

        if (!targetAccountId) {
          unassignedCount++;
          continue;
        }

        // Initialize account balance if not present
        if (forecastBalances[targetAccountId] === undefined) {
          const acc = accounts.find((a) => a.id === targetAccountId);
          forecastBalances[targetAccountId] = acc ? Number(acc.balance) || 0 : 0;
        }

        forecastBalances[targetAccountId] -= amt;
      } else if (occ.type === 'income') {
        let targetAccountId = occ.accountId;

        // If no accountId and exactly one non-archived account, assign to it
        if (!targetAccountId && singleAccount) {
          targetAccountId = singleAccount.id;
        }

        if (!targetAccountId) {
          unassignedCount++;
          continue;
        }

        // Initialize account balance if not present
        if (forecastBalances[targetAccountId] === undefined) {
          const acc = accounts.find((a) => a.id === targetAccountId);
          forecastBalances[targetAccountId] = acc ? Number(acc.balance) || 0 : 0;
        }

        forecastBalances[targetAccountId] += amt;
      } else if (occ.type === 'transfer') {
        const fromId = occ.fromAccountId;
        const toId = occ.toAccountId;

        if (!fromId || !toId) {
          unassignedCount++;
          continue;
        }

        if (forecastBalances[fromId] === undefined) {
          const fromAcc = accounts.find((a) => a.id === fromId);
          forecastBalances[fromId] = fromAcc ? Number(fromAcc.balance) || 0 : 0;
        }
        if (forecastBalances[toId] === undefined) {
          const toAcc = accounts.find((a) => a.id === toId);
          forecastBalances[toId] = toAcc ? Number(toAcc.balance) || 0 : 0;
        }

        forecastBalances[fromId] -= amt;
        forecastBalances[toId] += amt;
      }
    }

    // Calculate forecast net worth
    const forecastNetWorth = Object.values(forecastBalances).reduce(
      (sum, bal) => sum + (Number(bal) || 0),
      0
    );

    const delta = forecastNetWorth - currentNetWorth;

    return {
      currentNetWorth,
      currentDebt,
      forecastNetWorth,
      delta,
      unassignedCount,
    };
  }, [totalBalance, balanceById, recurring, accounts]);

  // ---- Upcoming recurring (next 30 days) ----
  const upcomingOccurrences = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getUpcomingOccurrences(recurring, today, 30);
  }, [recurring]);


  // ---- Upcoming totals (30 days + weekly average) ----
  const upcomingTotals = useMemo(() => {
    if (upcomingOccurrences.length === 0) {
      return null;
    }

    let totalOutgoing30 = 0;
    let totalIncoming30 = 0;

    for (const occ of upcomingOccurrences) {
      const amt = Number(occ.amount) || 0;

      if (occ.type === 'expense') totalOutgoing30 += amt;
      else if (occ.type === 'income') totalIncoming30 += amt;
      else if (occ.type === 'transfer') {
        // Transfers move money: count as outgoing + incoming (net zero)
        totalOutgoing30 += amt;
        totalIncoming30 += amt;
      }
    }

    const net30 = totalIncoming30 - totalOutgoing30;

    // Weekly average (30 days / 7 ≈ 4.2857 weeks)
    const weeklyOutgoing = totalOutgoing30 / (30 / 7);
    const weeklyIncoming = totalIncoming30 / (30 / 7);
    const weeklyNet = weeklyIncoming - weeklyOutgoing;

    return {
      totalOutgoing30: Math.round(totalOutgoing30 * 100) / 100,
      totalIncoming30: Math.round(totalIncoming30 * 100) / 100,
      net30: Math.round(net30 * 100) / 100,
      weeklyOutgoing: Math.round(weeklyOutgoing * 100) / 100,
      weeklyIncoming: Math.round(weeklyIncoming * 100) / 100,
      weeklyNet: Math.round(weeklyNet * 100) / 100,
    };
  }, [upcomingOccurrences]);

  const upcomingTop = useMemo(() => upcomingOccurrences.slice(0, 5), [upcomingOccurrences]);
  const hasMoreUpcoming = upcomingOccurrences.length > 5;

  // ---- Logout handler: back to Login (PIN) ----
  const handleLogout = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  }, [navigation]);

  // Set header with Settings and Logout buttons
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', columnGap: 8 }}>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={8}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Settings</Text>
          </Pressable>
          <Pressable
            onPress={handleLogout}
            hitSlop={8}
            style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          >
            <Text style={{ color: theme.negative, fontSize: 16, fontWeight: '700' }}>Logout</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, handleLogout]);

  return (
    <SafeAreaView style={styles.safeWrap}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
        {/* ---------- Subtitle ---------- */}
        <View style={styles.subtitleRow}>
          <Text style={styles.subtle}>
            Quick view of balances, activity & upcoming payments
          </Text>
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

        {/* ---------- Forecast Card ---------- */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Forecast (next 30 days)</Text>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Current Net Worth</Text>
              <Text style={styles.summaryValue}>{formatMoney(forecast.currentNetWorth)}</Text>
              {forecast.currentDebt > 0 && (
                <Text style={styles.summarySub}>Debt: {formatMoney(forecast.currentDebt)}</Text>
              )}
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Forecast Net Worth</Text>
              <Text
                style={[
                  styles.summaryValue,
                  forecast.delta >= 0 ? styles.positiveText : styles.negativeText,
                ]}
              >
                {formatMoney(forecast.forecastNetWorth)}
              </Text>
              <Text
                style={[
                  styles.summarySub,
                  forecast.delta >= 0 ? styles.positiveText : styles.negativeText,
                ]}
              >
                {forecast.delta >= 0 ? '+' : ''}
                {formatMoney(forecast.delta)}
              </Text>
            </View>
          </View>

          {forecast.unassignedCount > 0 && (
            <Text style={[styles.subtle, { marginTop: 8 }]}>
              Unassigned upcoming: {forecast.unassignedCount}
            </Text>
          )}
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
              {upcomingTotals && (
                <View style={styles.upcomingTotals}>
                  <Text style={styles.upcomingTotalsLine}>
                    <Text style={styles.upcomingTotalsLabel}>Next 30 days: </Text>
                    <Text style={styles.upcomingTotalsValue}>
                      Out {formatMoney(upcomingTotals.totalOutgoing30)}
                    </Text>
                    <Text style={styles.upcomingTotalsSeparator}> · </Text>
                    <Text style={styles.upcomingTotalsValue}>
                      In {formatMoney(upcomingTotals.totalIncoming30)}
                    </Text>
                    <Text style={styles.upcomingTotalsSeparator}> · </Text>
                    <Text
                      style={[
                        styles.upcomingTotalsValue,
                        upcomingTotals.net30 >= 0 ? styles.positiveText : styles.negativeText,
                      ]}
                    >
                      Net {formatMoney(upcomingTotals.net30)}
                    </Text>
                  </Text>
                  <Text style={[styles.upcomingTotalsLine, { marginTop: 4 }]}>
                    <Text style={styles.upcomingTotalsLabel}>Avg per week: </Text>
                    <Text style={styles.upcomingTotalsValue}>
                      Out {formatMoney(upcomingTotals.weeklyOutgoing)}
                    </Text>
                    <Text style={styles.upcomingTotalsSeparator}> · </Text>
                    <Text style={styles.upcomingTotalsValue}>
                      In {formatMoney(upcomingTotals.weeklyIncoming)}
                    </Text>
                    <Text style={styles.upcomingTotalsSeparator}> · </Text>
                    <Text
                      style={[
                        styles.upcomingTotalsValue,
                        upcomingTotals.weeklyNet >= 0 ? styles.positiveText : styles.negativeText,
                      ]}
                    >
                      Net {formatMoney(upcomingTotals.weeklyNet)}
                    </Text>
                  </Text>
                </View>
              )}

              {upcomingTop.map((occ, idx) => {
                const d = getOccurrenceDisplay(occ, accountById, formatMoney, formatDate);

                const amountStyle =
                  d.tone === 'income'
                    ? [styles.upcomingAmount, styles.positiveText]
                    : d.tone === 'expense'
                    ? [styles.upcomingAmount, styles.negativeText]
                    : [styles.upcomingAmount, { color: theme.text }];

                return (
                  <View
                    key={`${occ.itemId}-${occ.dueDate.getTime()}`}
                    style={[styles.upcomingRow, idx === 0 && { borderTopWidth: 0, marginTop: 0 }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.upcomingTitle}>{d.title}</Text>
                      <Text style={styles.upcomingSub}>{d.subtitle}</Text>
                    </View>

                    <Text style={amountStyle}>{d.amountText}</Text>
                  </View>
                );
              })}

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
    backgroundColor: theme.bg,
  },
  wrap: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // SUBTITLE
  subtitleRow: {
    marginBottom: 16,
  },
  subtle: {
    color: theme.textDim,
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
    backgroundColor: theme.card,
  },
  logoutPill: {
    borderColor: theme.negative,
  },
  headerPillText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '600',
  },

  // SUMMARY CARD
  summaryCard: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
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
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  summarySub: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  positiveText: {
    color: theme.positive,
  },
  negativeText: {
    color: theme.negative,
  },

  // CARD
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
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cardLink: {
    color: theme.link,
    fontSize: 13,
    fontWeight: '600',
  },

  // UPCOMING TOTALS
  upcomingTotals: {
    marginTop: 8,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  upcomingTotalsLine: {
    fontSize: 12,
  },
  upcomingTotalsLabel: {
    color: theme.textDim,
  },
  upcomingTotalsValue: {
    color: theme.text,
    fontWeight: '600',
  },
  upcomingTotalsSeparator: {
    color: theme.textDim,
  },
  // UPCOMING ROWS
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: theme.cardAlt,
    marginTop: 4,
  },
  upcomingTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  upcomingSub: {
    color: theme.textDim,
    fontSize: 12,
  },
  upcomingAmount: {
    color: '#E5E7EB',
    fontWeight: '700',
    marginLeft: 8,
  },

  // ACCOUNTS
  emptyText: {
    color: theme.textDim,
    marginTop: 10,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  accountName: {
    color: theme.text,
    fontWeight: '800',
  },
  accountMeta: {
    color: theme.textDim,
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
    color: theme.link,
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
    backgroundColor: theme.cardAlt,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  gridTitle: {
    color: theme.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  gridSub: {
    color: theme.textDim,
    fontSize: 12,
  },

  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  smallBtnText: {
    color: theme.pillText,
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
