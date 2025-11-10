// src/screens/TxnEditorScreen.tsx
import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useApp } from '../state/AppProvider';

const CATEGORIES = [
  'General',
  'Groceries',
  'Bills',
  'Transport',
  'Shopping',
  'Entertainment',
  'Savings',
];

type Props = {
  navigation: any;
  route: any;
};

export default function TxnEditorScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();
  const accounts = state.accounts || [];
  const txs = state.transactions || [];

  const params = route?.params || {};
  const editingId: string | undefined = params.id;
  const initialAccountId: string | undefined = params.accountId;
  const initialTypeParam: 'income' | 'expense' | undefined = params.type;

  const existing = editingId
    ? txs.find((t) => t.id === editingId)
    : undefined;

  const todayStr = new Date().toISOString().slice(0, 10);

  const [accountId, setAccountId] = React.useState<string>(
    existing?.accountId ||
      initialAccountId ||
      (accounts[0]?.id ?? '')
  );
  const [amount, setAmount] = React.useState<string>(
    existing ? String(existing.amount) : ''
  );
  const [type, setType] = React.useState<'income' | 'expense'>(
    existing?.type || initialTypeParam || 'expense'
  );
  const [note, setNote] = React.useState<string>(existing?.note || '');
  const [date, setDate] = React.useState<string>(
    existing?.date || todayStr
  );
  const [category, setCategory] = React.useState<string>(
    existing?.category || 'General'
  );
  const [saving, setSaving] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: editingId ? 'Edit transaction' : 'New transaction',
    });
  }, [navigation, editingId]);

  const onSave = async () => {
    const amt = Number(amount);

    if (!accountId) {
      Alert.alert('Account required', 'Please choose an account.');
      return;
    }
    if (!amount || isNaN(amt)) {
      Alert.alert('Amount required', 'Enter a valid amount.');
      return;
    }

    const cleanDate = date || todayStr;

    const payload = {
      accountId,
      amount: amt,
      type,
      date: cleanDate,
      note: note.trim() || null,
      category: category || null,
    };

    try {
      setSaving(true);
      if (editingId) {
        // assumes actions.updateTransaction(id, payload) exists
        await actions.updateTransaction(editingId, payload);
      } else {
        // assumes actions.addTransaction(payload) exists
        await actions.addTransaction(payload);
      }
      navigation.goBack();
    } catch (e: any) {
      console.warn('save txn failed', e);
      Alert.alert('Error', e?.message || 'Could not save transaction.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!editingId) return;
    Alert.alert('Delete transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // assumes actions.deleteTransaction(id) exists
            await actions.deleteTransaction(editingId);
            navigation.goBack();
          } catch (e: any) {
            console.warn('delete txn failed', e);
            Alert.alert('Error', e?.message || 'Could not delete transaction.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.wrap}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Account selector */}
      <Text style={styles.label}>Account</Text>
      <View style={styles.accountRow}>
        {accounts.length === 0 ? (
          <Text style={styles.subtle}>
            No accounts yet. Go back and add one on the Dashboard.
          </Text>
        ) : (
          accounts.map((acc) => (
            <Pressable
              key={acc.id}
              onPress={() => setAccountId(acc.id)}
              style={[
                styles.accPill,
                accountId === acc.id && styles.accPillActive,
              ]}
            >
              <Text
                style={[
                  styles.accPillText,
                  accountId === acc.id && styles.accPillTextActive,
                ]}
              >
                {acc.name || 'Account'}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Type */}
      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        <Pressable
          onPress={() => setType('expense')}
          style={[
            styles.typePill,
            type === 'expense' && styles.typePillActive,
          ]}
        >
          <Text
            style={[
              styles.typePillText,
              type === 'expense' && styles.typePillTextActive,
            ]}
          >
            Expense
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setType('income')}
          style={[
            styles.typePill,
            type === 'income' && styles.typePillActive,
          ]}
        >
          <Text
            style={[
              styles.typePillText,
              type === 'income' && styles.typePillTextActive,
            ]}
          >
            Income
          </Text>
        </Pressable>
      </View>

      {/* Amount */}
      <Text style={styles.label}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />

      {/* Category */}
      <Text style={styles.label}>Category</Text>
      <View style={styles.catRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.catPill,
              category === cat && styles.catPillActive,
            ]}
          >
            <Text
              style={[
                styles.catPillText,
                category === cat && styles.catPillTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Note */}
      <Text style={styles.label}>Note</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor="#6B7280"
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        multiline
      />

      {/* Save */}
      <Pressable
        onPress={onSave}
        style={styles.saveBtn}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : 'Save transaction'}
        </Text>
      </Pressable>

      {/* Delete (only in edit mode) */}
      {editingId && (
        <Pressable
          onPress={onDelete}
          style={styles.deleteBtn}
          disabled={saving}
        >
          <Text style={styles.deleteText}>Delete transaction</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
  },
  label: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  subtle: {
    color: '#9CA3AF',
    fontSize: 12,
  },

  accountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  accPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#020617',
  },
  accPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  accPillText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  accPillTextActive: {
    color: '#F9FAFB',
  },

  typeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    marginTop: 4,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 6,
    backgroundColor: '#020617',
  },
  typePillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  typePillText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  typePillTextActive: {
    color: '#F9FAFB',
  },

  input: {
    backgroundColor: '#020617',
    color: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },

  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 8,
  },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#020617',
  },
  catPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  catPillText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  catPillTextActive: {
    color: '#F9FAFB',
  },

  saveBtn: {
    marginTop: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },

  deleteBtn: {
    marginTop: 12,
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteText: {
    color: '#FEE2E2',
    fontWeight: '700',
  },
});
