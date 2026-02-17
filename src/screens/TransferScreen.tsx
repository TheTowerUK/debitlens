// src/screens/TransferScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import { formatDateDDMMYYYY } from '../utils/formatDate';
import { colors as theme } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Transfer'>;

type BalanceStatus = 'normal' | 'amber' | 'red';

function getStatus(balance: number, limitValue?: number): BalanceStatus {
  const limVal = Number(limitValue);
  const has = Number.isFinite(limVal) && limVal > 0;

  if (balance > 0) return 'normal';
  if (!has) return 'amber';
  if (balance < -limVal) return 'red';
  return 'amber';
}

// Parse DD/MM/YYYY into a Date (or null if invalid)
function parseDDMMYYYY(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('/');
  if (parts.length !== 3) return null;

  const [ddStr, mmStr, yyyyStr] = parts;
  const day = Number(ddStr);
  const month = Number(mmStr);
  const year = Number(yyyyStr);

  if (!day || !month || !year) return null;
  if (year < 1900 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const d = new Date(year, month - 1, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  d.setHours(0, 0, 0, 0);
  return d;
}

const TransferScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions ?? [];

  const balanceForAccountId = (id: string | undefined) => {
    if (!id) return 0;
    const acc = accounts.find((a) => a.id === id);
    const opening = Number(acc?.balance) || 0;

    let net = 0;
    for (const t of txs) {
      const amt = Number(t.amount) || 0;

      if (t.type === 'income' && t.accountId === id) net += amt;
      else if (t.type === 'expense' && t.accountId === id) net -= amt;
      else if (t.type === 'transfer') {
        if (t.fromAccountId === id) net -= amt;
        else if (t.toAccountId === id) net += amt;
        else if (t.accountId === id && !t.fromAccountId && !t.toAccountId) net -= amt;
      }
    }

    return opening + net;
  };

  const params = route.params ?? {};
  const initialFromId = params.fromAccountId;

  const [fromAccountId, setFromAccountId] = useState<string | undefined>(
    initialFromId ?? accounts[0]?.id
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(
    accounts.length > 1
      ? accounts.find((a: any) => a.id !== initialFromId)?.id ?? accounts[0]?.id
      : accounts[0]?.id
  );
  const [amount, setAmount] = useState<string>('');

  // UI date as DD/MM/YYYY
  const todayISO = new Date().toISOString();
  const [dateInput, setDateInput] = useState<string>(
    formatDateDDMMYYYY(todayISO)
  );

  const [note, setNote] = useState<string>('');

  const fromBalance = useMemo(
    () => balanceForAccountId(fromAccountId),
    [fromAccountId, accounts, txs]
  );

  const toBalance = useMemo(
    () => balanceForAccountId(toAccountId),
    [toAccountId, accounts, txs]
  );

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;

  const fromAfter = amountValid ? fromBalance - amountNum : fromBalance;
  const toAfter = amountValid ? toBalance + amountNum : toBalance;

  const fromAcc = accounts.find((a) => a.id === fromAccountId);
  const limit = Number(fromAcc?.limit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  const lim = hasLimit ? limit : 0;

  const usedNow = Math.max(0, -fromBalance);
  const usedAfter = Math.max(0, -fromAfter);
  const remainingNow = hasLimit ? Math.max(0, lim - usedNow) : null;
  const remainingAfter = hasLimit ? Math.max(0, lim - usedAfter) : null;
  const creditUsedPctNow =
    fromAcc?.type === 'credit' && hasLimit ? Math.min(100, (usedNow / lim) * 100) : null;
  const creditUsedPctAfter =
    fromAcc?.type === 'credit' && hasLimit ? Math.min(100, (usedAfter / lim) * 100) : null;

  const statusAfter: BalanceStatus = amountValid
    ? getStatus(fromAfter, fromAcc?.limit)
    : getStatus(fromBalance, fromAcc?.limit);

  const statusTextStyle =
    statusAfter === 'red'
      ? styles.statusRed
      : statusAfter === 'amber'
        ? styles.statusAmber
        : styles.statusNormal;

  const statusBorderStyle =
    statusAfter === 'red'
      ? styles.statusBorderRed
      : statusAfter === 'amber'
        ? styles.statusBorderAmber
        : styles.statusBorderNormal;

  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(previewOpacity, {
      toValue: amountValid ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [amountValid, previewOpacity]);

  useEffect(() => {
    if (!amountValid) return;
    previewScale.setValue(1);
    Animated.sequence([
      Animated.timing(previewScale, {
        toValue: 1.015,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(previewScale, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [amount, amountValid, previewScale]);

  const canTransfer = useMemo(() => accounts.length >= 2, [accounts.length]);

  const onSave = () => {
    if (!canTransfer) {
      Alert.alert(
        'Need more accounts',
        'You need at least two accounts to make a transfer.'
      );
      return;
    }

    if (!fromAccountId || !toAccountId) {
      Alert.alert('Select accounts', 'Please choose both from and to accounts.');
      return;
    }

    if (fromAccountId === toAccountId) {
      Alert.alert(
        'Same account',
        'From and to accounts must be different for a transfer.'
      );
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than zero.');
      return;
    }

    const parsedDate = parseDDMMYYYY(dateInput);
    if (!parsedDate) {
      Alert.alert(
        'Invalid date',
        'Please use format DD/MM/YYYY, e.g. 21/11/2025.'
      );
      return;
    }
    const dateISO =
      `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;

    const toAcc = accounts.find((a: any) => a.id === toAccountId);
    const desc = note.trim() || `Transfer to ${toAcc?.name ?? 'account'}`;

    actions.addTransaction({
      type: 'transfer',
      accountId: fromAccountId,
      fromAccountId,
      toAccountId,
      amount: numericAmount,
      date: dateISO,
      name: 'Transfer',
      description: desc,
      category: 'Transfer',
      merchant: toAcc?.name,
    });

    navigation.goBack();
  };


  const onCancel = () => {
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Transfer between accounts</Text>
        <Text style={styles.subtle}>
          Move money from one account to another.
        </Text>

        {!canTransfer && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              You need at least two accounts before you can make a transfer.
            </Text>
          </View>
        )}

        {/* From Account */}
        <View style={styles.field}>
          <Text style={styles.label}>From account</Text>
          <View style={styles.rowWrap}>
            {accounts.map((acc: any) => (
              <Pressable
                key={acc.id}
                style={[
                  styles.chip,
                  fromAccountId === acc.id && styles.chipSelected,
                ]}
                onPress={() => setFromAccountId(acc.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    fromAccountId === acc.id && styles.chipTextSelected,
                  ]}
                >
                  {acc.name || 'Account'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.balanceHint, statusTextStyle]}>
            Available: £{fromBalance.toFixed(2)}
          </Text>

          {hasLimit ? (
            <View style={styles.limitRow}>
              <Text style={[styles.limitText, statusTextStyle]}>
                {fromAcc?.type === 'credit'
                  ? `Credit used: ${creditUsedPctNow?.toFixed(0)}%`
                  : `Overdraft remaining: £${Number(remainingNow ?? 0).toFixed(2)}`}
              </Text>

              {amountValid ? (
                <Text style={[styles.limitTextDim, statusTextStyle]}>
                  After: {fromAcc?.type === 'credit'
                    ? `${creditUsedPctAfter?.toFixed(0)}%`
                    : `£${Number(remainingAfter ?? 0).toFixed(2)}`}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* To Account */}
        <View style={styles.field}>
          <Text style={styles.label}>To account</Text>
          <View style={styles.rowWrap}>
            {accounts.map((acc: any) => (
              <Pressable
                key={acc.id}
                style={[
                  styles.chip,
                  toAccountId === acc.id && styles.chipSelected,
                ]}
                onPress={() => setToAccountId(acc.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    toAccountId === acc.id && styles.chipTextSelected,
                  ]}
                >
                  {acc.name || 'Account'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.balanceHint}>
            Current: £{toBalance.toFixed(2)}
          </Text>
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#6b7280"
          />
          <Animated.View
            style={[
              styles.previewBox,
              statusBorderStyle,
              { opacity: previewOpacity, transform: [{ scale: previewScale }] },
            ]}
          >
            {amountValid ? (
              <>
                <Text style={styles.previewTitle}>After transfer</Text>

                <Text style={[styles.previewLine, statusTextStyle]}>
                  From: £{fromBalance.toFixed(2)} → £{fromAfter.toFixed(2)}
                </Text>

                <Text style={styles.previewLine}>
                  To: £{toBalance.toFixed(2)} → £{toAfter.toFixed(2)}
                </Text>

                {statusAfter === 'red' ? (
                  <Text style={styles.previewMsgRed}>
                    Over agreed {fromAcc?.type === 'credit' ? 'credit limit' : 'overdraft'}.
                  </Text>
                ) : statusAfter === 'amber' && fromAfter < 0 ? (
                  <Text style={styles.previewMsgAmber}>
                    This will take the account negative.
                  </Text>
                ) : null}
              </>
            ) : null}
          </Animated.View>
        </View>

        {/* Date (DD/MM/YYYY) */}
        <View style={styles.field}>
          <Text style={styles.label}>Date (DD/MM/YYYY)</Text>
          <TextInput
            style={styles.input}
            value={dateInput}
            onChangeText={setDateInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Note */}
        <View style={styles.field}>
          <Text style={styles.label}>Note (optional)</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Move to savings"
            placeholderTextColor="#6b7280"
            multiline
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveText}>Transfer</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingBottom: 32,
  },
  h1: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtle: {
    color: theme.textDim,
    marginBottom: 16,
  },
  balanceHint: {
    marginTop: 8,
    fontSize: 13,
    color: theme.textDim,
  },
  statusNormal: { color: theme.text },
  statusAmber: { color: '#F59E0B' },
  statusRed: { color: theme.negative },
  statusBorderNormal: { borderColor: theme.border },
  statusBorderAmber: { borderColor: '#F59E0B' },
  statusBorderRed: { borderColor: theme.negative },
  limitRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textDim,
  },
  limitTextDim: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textDim,
    opacity: 0.85,
  },
  previewBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: theme.cardAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewTitle: {
    color: theme.text,
    fontWeight: '700',
    marginBottom: 6,
  },
  previewLine: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewMsgAmber: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  previewMsgRed: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: theme.negative,
  },
  warningBox: {
    backgroundColor: '#451a03',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    marginBottom: 0,
  },
  warningText: {
    color: '#fed7aa',
    fontSize: 13,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.cardAlt,
    color: theme.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  chipTextSelected: {
    color: theme.text,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    backgroundColor: theme.cardAlt,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  cancelText: {
    color: '#e5e7eb',
    fontWeight: '500',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default TransferScreen;
