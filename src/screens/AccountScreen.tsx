// src/screens/AccountScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ route, navigation }: Props) {
  const { accountId } = route.params;
  const { state, actions } = useApp();

  const account = state.accounts.find(a => a.id === accountId);
  const allTxs = state.transactions || [];

  const txsForAccount = useMemo(
    () =>
      allTxs
        .filter(t => t.accountId === accountId)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [allTxs, accountId]
  );

  const balance = useMemo(() => {
    return txsForAccount.reduce((sum, t) => {
      const amt = Number(t.amount || 0);
      return t.type === 'income' ? sum + amt : sum - amt;
    }, 0);
  }, [txsForAccount]);

  const canDelete = txsForAccount.length === 0;

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.error}>Account not found.</Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const onDeleteAccount = () => {
    if (!canDelete) {
      Alert.alert(
        'Cannot delete account',
        'This account still has transactions. Remove or move its transactions first.'
      );
      return;
    }

    Alert.alert(
      'Delete account',
      `Delete “${account.name}”? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteAccount(accountId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>{account.name}</Text>
          <Text
            style={[
              styles.balance,
              balance < 0 ? styles.balanceNeg : styles.balancePos,
            ]}
          >
            £{Math.abs(balance).toFixed(2)}
          </Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.btn, styles.btnPrimary, { flex: 1 }]}
          onPress={() => navigation.navigate('TxnEditor', { accountId })}
        >
          <Text style={styles.btnText}>+ Transaction</Text>
        </Pressable>

        <Pressable
          style={[
            styles.btn,
            canDelete ? styles.btnDanger : styles.btnDisabled,
          ]}
          onPress={onDeleteAccount}
        >
          <Text style={styles.btnText}>
            {canDelete ? 'Delete account' : 'Cannot delete'}
          </Text>
        </Pressable>
      </View>

      {/* Transactions list */}
      <FlatList
        data={txsForAccount}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions yet.</Text>
        }
        renderItem={({ item }) => {
          const isIncome = item.type === 'income';
          const sign = isIncome ? '+' : '-';
          const d = item.date ? new Date(`${item.date}T00:00:00`) : null;

          return (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>
                  {item.note || (isIncome ? 'Income' : 'Expense')}
                </Text>
                <Text style={styles.rowSub}>
                  {d ? d.toLocaleDateString() : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  isIncome ? styles.rowAmountIncome : styles.rowAmountExpense,
                ]}
              >
                {sign}£{Number(item.amount || 0).toFixed(2)}
              </Text>
            </View>
          );
        }}
      />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  h1: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
  },
  balance: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  balancePos: {
    color: '#4ADE80',
  },
  balanceNeg: {
    color: '#F97373',
  },
  backLink: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnDanger: {
    backgroundColor: '#B91C1C',
  },
  btnDisabled: {
    backgroundColor: '#374151',
  },
  btnText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 13,
  },
  empty: {
    color: '#9CA3AF',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#111827',
  },
  rowLeft: {
    flexShrink: 1,
    paddingRight: 8,
  },
  rowTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  rowSub: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowAmountIncome: {
    color: '#4ADE80',
  },
  rowAmountExpense: {
    color: '#F97373',
  },
  error: {
    color: '#FCA5A5',
    marginTop: 16,
  },
});
