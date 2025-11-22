// src/screens/RecurringEditorScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  useApp,
  type RecurringItem,
  type RecurringFrequency,
} from '../state/AppProvider';

type RouteParams = {
  id?: string;
};

const FREQUENCIES: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const RecurringEditorScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { state, actions } = useApp();

  const params: RouteParams = route.params || {};
  const editingId = params.id;

  const recurring = state.recurring || [];
  const accounts = state.accounts || [];

  const existing: RecurringItem | undefined = useMemo(
    () => recurring.find((r) => r.id === editingId),
    [recurring, editingId]
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(
    existing ? String(existing.amount) : ''
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    existing?.frequency ?? 'monthly'
  );
  const [active, setActive] = useState<boolean>(
    existing?.active ?? true
  );

  // NEW: mode – single-account vs transfer
  const [isTransfer, setIsTransfer] = useState<boolean>(existing?.isTransfer ?? false);

  // For single-account recurring
  const [singleAccountId, setSingleAccountId] = useState<string | undefined>(
    existing?.accountId ?? accounts[0]?.id
  );
  const [type, setType] = useState<'income' | 'expense'>(
    existing?.type ?? 'expense'
  );

  // For transfer recurring
  const [fromAccountId, setFromAccountId] = useState<string | undefined>(
    existing?.fromAccountId ?? accounts[0]?.id
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(
    existing?.toAccountId ??
      (accounts.length > 1 ? accounts[1]?.id : accounts[0]?.id)
  );

  // Next-due date (DD-MM-YYYY format)
  const [nextDueDateInput, setNextDueDateInput] = useState<string>(
    existing?.nextDueDate ? existing.nextDueDate.slice(0, 10) : ''
  );

  const onSave = () => {
    const cleanTitle = title.trim();
    const numericAmount = Number(amount);

    if (!cleanTitle) {
      Alert.alert('Missing title', 'Please enter a title.');
      return;
    }

    if (!numericAmount || isNaN(numericAmount)) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (!accounts.length) {
      Alert.alert(
        'No accounts',
        'Please create at least one account before adding a recurring item.'
      );
      return;
    }

    // Handle date
    const trimmedDate = nextDueDateInput.trim();
    let nextDueISO: string;
    if (!trimmedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDueISO = today.toISOString();
    } else {
      const parsed = new Date(trimmedDate);
      if (isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Please use format DD-MM-YYYY.');
        return;
      }
      parsed.setHours(0, 0, 0, 0);
      nextDueISO = parsed.toISOString();
    }

    if (isTransfer) {
      // --- Transfer recurring ---
      if (accounts.length < 2) {
        Alert.alert(
          'Need more accounts',
          'You need at least two accounts to set up a recurring transfer.'
        );
        return;
      }

      if (!fromAccountId || !toAccountId) {
        Alert.alert(
          'Select accounts',
          'Please choose both From and To accounts.'
        );
        return;
      }

      if (fromAccountId === toAccountId) {
        Alert.alert(
          'Same account',
          'From and To accounts must be different for a transfer.'
        );
        return;
      }

      const item: RecurringItem = {
        id: existing?.id ?? `rec_${Date.now()}`, // your ID helper is optional here
        title: cleanTitle,
        amount: numericAmount,
        frequency,
        isTransfer: true,
        fromAccountId,
        toAccountId,
        active,
        nextDueDate: nextDueISO,
      };

      if (existing) {
        actions.updateRecurring(existing.id, item);
      } else {
        actions.addRecurring(item);
      }
    } else {
      // --- Single-account recurring ---
      const chosenAccountId = singleAccountId || accounts[0].id;

      const item: RecurringItem = {
        id: existing?.id ?? `rec_${Date.now()}`,
        title: cleanTitle,
        amount: numericAmount,
        frequency,
        accountId: chosenAccountId,
        type,
        active,
        nextDueDate: nextDueISO,
        isTransfer: false,
        fromAccountId: undefined,
        toAccountId: undefined,
      };

      if (existing) {
        actions.updateRecurring(existing.id, item);
      } else {
        actions.addRecurring(item);
      }
    }

    navigation.goBack();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert(
      'Delete recurring item',
      `Are you sure you want to delete "${existing.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteRecurring(existing.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const screenTitle = existing ? 'Edit Recurring' : 'Add Recurring';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>{screenTitle}</Text>

        {/* Mode: single vs transfer */}
        <View style={styles.field}>
          <Text style={styles.label}>Mode</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.chip,
                !isTransfer && styles.chipSelected,
              ]}
              onPress={() => setIsTransfer(false)}
            >
              <Text
                style={[
                  styles.chipText,
                  !isTransfer && styles.chipTextSelected,
                ]}
              >
                Single account
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                isTransfer && styles.chipSelected,
              ]}
              onPress={() => setIsTransfer(true)}
            >
              <Text
                style={[
                  styles.chipText,
                  isTransfer && styles.chipTextSelected,
                ]}
              >
                Transfer between accounts
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Netflix, Rent, Move to savings"
            placeholderTextColor="#6b7280"
          />
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
        </View>

        {/* Account / Transfer Accounts */}
        {isTransfer ? (
          <>
            {/* From account */}
            <View style={styles.field}>
              <Text style={styles.label}>From account</Text>
              {accounts.length === 0 ? (
                <Text style={styles.helperText}>
                  No accounts yet. Add at least two accounts to set up a recurring transfer.
                </Text>
              ) : (
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
              )}
            </View>

            {/* To account */}
            <View style={styles.field}>
              <Text style={styles.label}>To account</Text>
              {accounts.length === 0 ? (
                <Text style={styles.helperText}>
                  No accounts yet. Add at least two accounts to set up a recurring transfer.
                </Text>
              ) : (
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
              )}
            </View>
          </>
        ) : (
          <>
            {/* Single account */}
            <View style={styles.field}>
              <Text style={styles.label}>Account</Text>
              {accounts.length === 0 ? (
                <Text style={styles.helperText}>
                  No accounts yet. Add an account from the Dashboard before creating recurring items.
                </Text>
              ) : (
                <View style={styles.rowWrap}>
                  {accounts.map((acc: any) => (
                    <Pressable
                      key={acc.id}
                      style={[
                        styles.chip,
                        singleAccountId === acc.id && styles.chipSelected,
                      ]}
                      onPress={() => setSingleAccountId(acc.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          singleAccountId === acc.id && styles.chipTextSelected,
                        ]}
                      >
                        {acc.name || 'Account'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Type */}
            <View style={styles.field}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.chip,
                    type === 'expense' && styles.chipSelected,
                  ]}
                  onPress={() => setType('expense')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      type === 'expense' && styles.chipTextSelected,
                    ]}
                  >
                    Expense
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    type === 'income' && styles.chipSelected,
                  ]}
                  onPress={() => setType('income')}
                >
                  <Text
                    style={[
                      styles.chipText,
                      type === 'income' && styles.chipTextSelected,
                    ]}
                  >
                    Income
                  </Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Frequency */}
        <View style={styles.field}>
          <Text style={styles.label}>Frequency</Text>
          <View style={styles.rowWrap}>
            {FREQUENCIES.map((f) => (
              <Pressable
                key={f}
                style={[
                  styles.chip,
                  frequency === f && styles.chipSelected,
                ]}
                onPress={() => setFrequency(f)}
              >
                <Text
                  style={[
                    styles.chipText,
                    frequency === f && styles.chipTextSelected,
                  ]}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Next due date */}
        <View style={styles.field}>
          <Text style={styles.label}>Next due date</Text>
          <TextInput
            style={styles.input}
            value={nextDueDateInput}
            onChangeText={setNextDueDateInput}
            placeholder="DD-MM-YYYY (leave blank for today)"
            placeholderTextColor="#6b7280"
          />
        </View>

        {/* Status */}
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.row}>
            <Pressable
              style={[
                styles.chip,
                active && styles.chipSelected,
              ]}
              onPress={() => setActive(true)}
            >
              <Text
                style={[
                  styles.chipText,
                  active && styles.chipTextSelected,
                ]}
              >
                Active
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.chip,
                !active && styles.chipSelected,
              ]}
              onPress={() => setActive(false)}
            >
              <Text
                style={[
                  styles.chipText,
                  !active && styles.chipTextSelected,
                ]}
              >
                Paused
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          {existing && (
            <Pressable style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}

          <Pressable style={styles.saveBtn} onPress={onSave}>
            <Text style={styles.saveBtnText}>
              {existing ? 'Save Changes' : 'Add Recurring'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  h1: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    color: '#e5e7eb',
    marginBottom: 6,
    fontWeight: '500',
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  input: {
    backgroundColor: '#111827',
    color: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    columnGap: 8,
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
    color: '#f9fafb',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 8,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#f9fafb',
    fontWeight: '600',
    fontSize: 16,
  },
  deleteBtn: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  deleteBtnText: {
    color: '#f87171',
    fontWeight: '500',
  },
});

export default RecurringEditorScreen;
