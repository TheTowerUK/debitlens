// src/screens/DashboardScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useApp, type Transaction } from '../state/AppContext';

type Props = {
  navigation: any;
};

const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useApp();
  const accounts = state.accounts ?? [];
  const transactions: Transaction[] = state.transactions ?? [];

  // Build a balance map per account from transactions (income +, expense -)
  const { accountBalances, totalBalance } = useMemo(() => {
    const balances = new Map<string, number>();

    transactions.forEach((t) => {
      if (!t.accountId) return;
      const amount = Number(t.amount) || 0;
      const delta = t.type === 'income' ? amount : -amount;
      balances.set(t.accountId, (balances.get(t.accountId) || 0) + delta);
    });

    const total = Array.from(balances.values()).reduce(
      (sum, b) => sum + b,
      0
    );

    return { accountBalances: balances, totalBalance: total };
  }, [transactions]);

  // Recent transactions (last 5 by date desc)
  const recentTxs = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => {
        const da = a.date ? Date.parse(a.date) : 0;
        const db = b.date ? Date.parse(b.date) : 0;
        return db - da;
      })
      .slice(0, 5);
  }, [transactions]);

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      {/* Header */}
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.subtle}>
        Overview of your accounts, spending, and upcoming activity.
      </Text>

      {/* Balance summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total balance</Text>
        <Text style={styles.balanceValue}>
          £{totalBalance.toFixed(2)}
        </Text>
        <Text style={styles.cardSubtitle}>
          Across {accounts.length} account
          {accounts.length === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Accounts strip */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        {accounts.length > 0 && (
          <Pressable onPress={() => navigation.navigate('RecentActivity')}>
            <Text style={styles.linkText}>View activity</Text>
          </Pressable>
        )}
      </View>

      {accounts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No accounts yet</Text>
          <Text style={styles.emptyText}>
            Add an account to start tracking balances and activity.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.accountRow}
        >
          {accounts.map((acc: any) => {
            const bal = accountBalances.get(acc.id) || 0;
            return (
              <Pressable
                key={acc.id}
                style={styles.accountCard}
                onPress={() =>
                  navigation.navigate('Account', { accountId: acc.id })
                }
              >
                <Text style={styles.accountName}>
                  {acc.name || 'Account'}
                </Text>
                <Text
                  style={[
                    styles.accountBalance,
                    bal >= 0 ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  £{bal.toFixed(2)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Quick navigation buttons */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
      </View>

      <View style={styles.buttonGrid}>
        <DashboardButton
          label="Add account"
          onPress={() => navigation.navigate('AddAccount')}
        />
        <DashboardButton
          label="Add transaction"
          onPress={() => navigation.navigate('TxnEditor')}
        />
        <DashboardButton
          label="Payments"
          onPress={() => navigation.navigate('Payments')}
        />
        <DashboardButton
          label="Recurring"
          onPress={() => navigation.navigate('Recurring')}
        />
        <DashboardButton
          label="Budgets"
          onPress={() => navigation.navigate('Budgets')}
        />
        <DashboardButton
          label="Reports"
          onPress={() => navigation.navigate('Reports')}
        />
        <DashboardButton
          label="Export / Import"
          onPress={() => navigation.navigate('DataExportImport')}
        />
      </View>

      {/* Recent activity */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <Pressable
          onPress={() => navigation.navigate('RecentActivity')}
        >
          <Text style={styles.linkText}>View all</Text>
        </Pressable>
      </View>

      {recentTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No recent transactions</Text>
          <Text style={styles.emptyText}>
            Add a transaction to start building your history.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {recentTxs.map((t) => {
            const isIncome = t.type === 'income';
            const sign = isIncome ? '+' : '-';
            const amount = Number(t.amount) || 0;
            const label = t.category || 'Uncategorised';
            const note = t.description || '';
            const dateLabel = t.date
              ? new Date(t.date).toLocaleDateString()
              : '';

            return (
              <View key={t.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  {note ? (
                    <Text style={styles.txNote}>{note}</Text>
                  ) : null}
                  {dateLabel ? (
                    <Text style={styles.txMeta}>{dateLabel}</Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    isIncome ? styles.incomeText : styles.expenseText,
                  ]}
                >
                  {sign}£{amount.toFixed(2)}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

type DashboardButtonProps = {
  label: string;
  onPress: () => void;
};

const DashboardButton: React.FC<DashboardButtonProps> = ({
  label,
  onPress,
}) => (
  <Pressable style={styles.actionButton} onPress={onPress}>
    <Text style={styles.actionButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  balanceValue: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
  },
  linkText: {
    color: '#93C5FD',
    fontSize: 13,
  },
  // Accounts strip
  accountRow: {
    paddingVertical: 4,
  },
  accountCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 8,
    minWidth: 140,
  },
  accountName: {
    color: '#E5E7EB',
    fontSize: 14,
    marginBottom: 4,
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Quick actions
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flexBasis: '48%',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2563EB',
    backgroundColor: '#020617',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#BFDBFE',
    fontWeight: '600',
    fontSize: 14,
  },

  // Empty / recent tx
  emptyBox: {
    marginTop: 4,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  emptyTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  txLabel: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },
  txNote: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  txMeta: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 12,
  },
  incomeText: {
    color: '#22C55E',
  },
  expenseText: {
    color: '#F97373',
  },
});

export default DashboardScreen;
