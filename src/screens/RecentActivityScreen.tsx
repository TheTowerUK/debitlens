// src/screens/RecentActivityScreen.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import type { Account } from '../state/AppContext';
import { formatDateDDMMYYYY } from '../utils/formatDate';
import { colors as theme } from '../theme/colors';
import {
  getSignedAmountForAccount,
  isTransfer,
  getTransferLabelAndNoteGlobal,
} from '../utils/txDisplay';

type Props = NativeStackScreenProps<RootStackParamList, 'RecentActivity'>;

const RecentActivityScreen: React.FC<Props> = ({ navigation }) => {
  const { state } = useApp();
  const txs = state.transactions ?? [];

  const accountsById = useMemo(() => {
    const map: Record<string, Account> = {};
    (state.accounts ?? []).forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [state.accounts]);

  const sortedTxs = useMemo(() => {
    const copy = [...txs];
    copy.sort(
      (x, y) =>
        (y.date ? Date.parse(y.date) : 0) -
        (x.date ? Date.parse(x.date) : 0)
    );
    return copy;
  }, [txs]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Recent activity</Text>
      <Text style={styles.subtle}>
        All your latest transactions in one place.
      </Text>

      {sortedTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isTransferTx = isTransfer(item);
            const signed = getSignedAmountForAccount(item, undefined);
            const { label, note } = isTransferTx
              ? getTransferLabelAndNoteGlobal(item, accountsById)
              : {
                  label: item.category || 'Uncategorised',
                  note: item.description || '',
                };

            const amountText = `£${Math.abs(Number(item.amount) || 0).toFixed(2)}`;
            const signChar = !isTransferTx ? (signed > 0 ? '+' : signed < 0 ? '-' : '') : '';

            return (
              <Pressable
                style={styles.txRow}
                onPress={() =>
                  navigation.navigate('TxnEditor', { id: item.id })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  {note ? <Text style={styles.txNote}>{note}</Text> : null}
                  {item.date ? (
                    <Text style={styles.txMeta}>
                      {formatDateDDMMYYYY(item.date)}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    isTransferTx
                      ? undefined
                      : signed > 0
                        ? styles.incomeText
                        : styles.expenseText,
                  ]}
                >
                  {isTransferTx ? amountText : `${signChar}${amountText}`}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
};

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
  subtle: { color: theme.textDim, marginBottom: 16 },

  emptyBox: {
    marginTop: 8,
    marginBottom: 16,
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
  emptyText: { color: theme.textDim, fontSize: 14 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardAlt,
  },
  txLabel: { color: theme.text, fontSize: 14, fontWeight: '700' },
  txNote: { color: theme.textDim, fontSize: 12 },
  txMeta: { color: '#6B7280', fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800', marginLeft: 12 },
  incomeText: { color: theme.positive },
  expenseText: { color: theme.negative },
});

export default RecentActivityScreen;
