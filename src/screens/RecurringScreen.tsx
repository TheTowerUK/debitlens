// src/screens/RecurringScreen.tsx
import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useApp,
  type RecurringItem,
  type RecurringFrequency,
  type Transaction,
} from '../state/AppContext';
import { formatDateDDMMYYYY } from '../utils/formatDate';

const FREQUENCY_LABEL: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const advanceDate = (date: Date, frequency: RecurringFrequency): Date => {
  const d = new Date(date.getTime());
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
};

const RecurringScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { state, actions } = useApp();

  const recurring: RecurringItem[] = state.recurring || [];
  const accounts = state.accounts || [];
  const txs: Transaction[] = state.transactions || [];

  const handleToggleActive = (item: RecurringItem) => {
    actions.updateRecurring(item.id, { active: !item.active });
  };

  const handleDelete = (item: RecurringItem) => {
    actions.deleteRecurring(item.id);
  };

  const handleEdit = (item: RecurringItem) => {
    navigation.navigate('RecurringEditor', { id: item.id });
  };

  const handleAddNew = () => {
    navigation.navigate('RecurringEditor');
  };

  const handleApplyDueNow = () => {
    if (!accounts.length) {
      Alert.alert(
        'No accounts',
        'You need at least one account before applying recurring items.'
      );
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let created = 0;

    recurring.forEach((r) => {
      if (r.active === false) return;

      const nextDate = r.nextDueDate ? new Date(r.nextDueDate) : today;
      nextDate.setHours(0, 0, 0, 0);

      if (nextDate > today) return;

      const amountNum = Number(r.amount) || 0;
      if (!amountNum) return;

      // --- Recurring transfer ---
      if (r.isTransfer && r.fromAccountId && r.toAccountId) {
        if (accounts.length < 2) return;
        if (r.fromAccountId === r.toAccountId) return;

        const fromAcc = accounts.find((a: any) => a.id === r.fromAccountId);
        const toAcc = accounts.find((a: any) => a.id === r.toAccountId);
        if (!fromAcc || !toAcc) return;

        const now = new Date();
        const isoDate = now.toISOString();

        const outNote = r.title || 'Transfer out';
        const inNote = r.title || 'Transfer in';

        // Outgoing (expense)
        actions.addTransaction({
          accountId: r.fromAccountId,
          amount: amountNum,
          type: 'expense',
          date: isoDate,
          category: 'Transfer',
          description: outNote,
        } as Transaction);

        // Incoming (income)
        actions.addTransaction({
          accountId: r.toAccountId,
          amount: amountNum,
          type: 'income',
          date: isoDate,
          category: 'Transfer',
          description: inNote,
        } as Transaction);

        const newNext = advanceDate(nextDate, r.frequency);
        actions.updateRecurring(r.id, {
          nextDueDate: newNext.toISOString(),
        });

        created += 2;
        return;
      }

      // --- Single-account recurring ---
      const fallbackAccountId = accounts[0].id;
      const accountId = r.accountId || fallbackAccountId;
      const txType: 'income' | 'expense' = r.type ?? 'expense';

      actions.addTransaction({
        accountId,
        amount: amountNum,
        type: txType,
        date: new Date().toISOString(),
        description: r.title,
        category: r.type === 'income' ? 'Recurring income' : 'Recurring payment',
      } as Transaction);

      const newNext = advanceDate(nextDate, r.frequency);
      actions.updateRecurring(r.id, {
        nextDueDate: newNext.toISOString(),
      });

      created += 1;
    });

    if (created === 0) {
      Alert.alert('Nothing due', 'No recurring items were due today.');
    } else {
      Alert.alert(
        'Recurring applied',
        `Created ${created} transaction${created === 1 ? '' : 's'}.`
      );
    }
  };

  /**
   * Detect recurring payments from history, focusing on
   * transactions whose category is "Direct Debit".
   */
  const handleDetectFromHistory = () => {
    if (!txs.length) {
      Alert.alert('No transactions', 'There are no transactions to analyse.');
      return;
    }

    // 1) Filter: expenses with category "Direct Debit" (case-insensitive)
    const ddCandidates = txs.filter((t) => {
      if (!t.category || !t.accountId) return false;
      const cat = String(t.category).trim().toLowerCase();
      return t.type === 'expense' && cat === 'direct debit';
    });

    if (!ddCandidates.length) {
      Alert.alert(
        'No Direct Debits found',
        'No expense transactions with category "Direct Debit" were found.'
      );
      return;
    }

    // 2) Group by account + title + amount
    //    Title derived from description || category.
    type GroupKey = string;
    const groups: Record<GroupKey, Transaction[]> = {};

    for (const t of ddCandidates) {
      const titleSource =
        (t.description || t.category || '').trim() || 'Direct Debit';
      const amountAbs = Math.abs(Number(t.amount) || 0);
      if (!t.accountId || !amountAbs) continue;

      const key: GroupKey = `${t.accountId}||${titleSource.toLowerCase()}||${amountAbs.toFixed(
        2
      )}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }

    let created = 0;

    // 3) For each group, create a monthly recurring if not already present
    Object.entries(groups).forEach(([key, list]) => {
      if (!list.length) return;

      // Take the latest transaction as the template
      const sorted = list
        .filter((t) => !!t.date)
        .slice()
        .sort((a, b) => {
          const da = a.date ? Date.parse(a.date) : 0;
          const db = b.date ? Date.parse(b.date) : 0;
          return db - da;
        });

      const sample = sorted[0] ?? list[0];
      if (!sample.accountId) return;

      const amountAbs = Math.abs(Number(sample.amount) || 0);
      if (!amountAbs) return;

      const titleSource =
        (sample.description || sample.category || '').trim() || 'Direct Debit';

      // Avoid duplicates: check if similar recurring already exists
      const exists = recurring.some((r) => {
        if (r.isTransfer) return false;
        if (!r.accountId) return false;

        const rTitle = (r.title || '').trim().toLowerCase();
        const sTitle = titleSource.toLowerCase();
        const rAmt = Math.abs(Number(r.amount) || 0);

        return (
          r.accountId === sample.accountId &&
          rTitle === sTitle &&
          rAmt === amountAbs
        );
      });

      if (exists) return;

      const nextDueDate =
        sample.date && typeof sample.date === 'string'
          ? sample.date
          : new Date().toISOString();

      const item: RecurringItem = {
        id: `rec_auto_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        title: titleSource,
        amount: amountAbs,
        frequency: 'monthly', // assume monthly for Direct Debits
        accountId: sample.accountId,
        type: 'expense',
        active: true,
        nextDueDate,
        isTransfer: false,
        fromAccountId: undefined,
        toAccountId: undefined,
      };

      actions.addRecurring(item);
      created++;
    });

    if (created === 0) {
      Alert.alert(
        'Already covered',
        'No new recurring items were created. Existing recurring items already cover these Direct Debits.'
      );
    } else {
      Alert.alert(
        'Recurring detected',
        `Created ${created} recurring Direct Debit item${
          created === 1 ? '' : 's'
        } from history.`
      );
    }
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.h1}>Recurring Payments</Text>

      <Pressable style={styles.applyButton} onPress={handleApplyDueNow}>
        <Text style={styles.applyButtonText}>Apply due now</Text>
      </Pressable>

      <Pressable
        style={[styles.applyButton, styles.detectButton]}
        onPress={handleDetectFromHistory}
      >
        <Text style={styles.applyButtonText}>Detect from history</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={handleAddNew}>
        <Text style={styles.buttonText}>Add Recurring</Text>
      </Pressable>

      {recurring.length === 0 && (
        <Text style={styles.subtle}>
          No recurring items yet. Tap &quot;Add Recurring&quot; to create one.
        </Text>
      )}

      {recurring.map((r) => {
        const isTransfer = !!r.isTransfer;
        const amountStr = `£${Number(r.amount).toFixed(2)}`;
        const freqStr = FREQUENCY_LABEL[r.frequency];

        let extraStr = '';
        if (isTransfer && r.fromAccountId && r.toAccountId) {
          const fromAcc = accounts.find((a: any) => a.id === r.fromAccountId);
          const toAcc = accounts.find((a: any) => a.id === r.toAccountId);
          const fromName = fromAcc?.name || 'From';
          const toName = toAcc?.name || 'To';
          extraStr = `Transfer ${fromName} → ${toName}`;
        } else if (r.type) {
          extraStr = r.type === 'income' ? 'Income' : 'Expense';
        }

        const subtitleParts = [amountStr, freqStr];
        if (extraStr) subtitleParts.push(extraStr);
        const subtitle = subtitleParts.join(' • ');
     
        return (
          <View key={r.id} style={styles.card}>
            <Pressable onPress={() => handleEdit(r)}>
              <Text style={styles.itemTitle}>
                {r.title ||
                  (isTransfer ? 'Recurring transfer' : 'Recurring item')}
              </Text>
              <Text style={styles.itemSubtitle}>{subtitle}</Text>
              {r.nextDueDate && (
                <Text style={styles.subtle}>
                  Next due: {formatDateDDMMYYYY(r.nextDueDate)}
                </Text>
              )}
            </Pressable>
           
            <View style={styles.rowActions}>
              <Pressable onPress={() => handleToggleActive(r)}>
                <Text
                  style={[
                    styles.badge,
                    r.active !== false ? styles.badgeActive : styles.badgePaused,
                  ]}
                >
                  {r.active !== false ? 'Active' : 'Paused'}
                </Text>
              </Pressable>

              <Pressable onPress={() => handleDelete(r)}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        );
      })}


    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 16,
  },
  subtle: {
    color: '#9ca3af',
    marginBottom: 8,
  },
  applyButton: {
    backgroundColor: '#0f172a',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2563eb',
    marginBottom: 8,
  },
  detectButton: {
    borderColor: '#4b5563',
  },
  applyButtonText: {
    color: '#bfdbfe',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  itemSubtitle: {
    color: '#9ca3af',
    marginTop: 4,
  },
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    columnGap: 16,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    overflow: 'hidden',
  },
  badgeActive: {
    color: '#22c55e',
  },
  badgePaused: {
    color: '#fbbf24',
  },
  deleteText: {
    color: '#f87171',
    fontSize: 14,
  },
  button: {
    marginTop: 24,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default RecurringScreen;
