// src/screens/AccountScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Switch,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppContext';
import type { Account } from '../state/AppContext';
import { colors as theme } from '../theme/colors';
import {
  getSignedAmountForAccount,
  isTransfer,
  getTransferLabelAndNoteForAccount,
} from '../utils/txDisplay';
import { daysUntilYMD } from '../utils/maturity';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export default function AccountScreen({ navigation, route }: Props) {
  const { state, actions } = useApp();

  const accountId = route.params?.accountId;
  const accounts = state.accounts || [];
  const txs = state.transactions || [];
  const recurring = state.recurring || [];

  const account =
    accounts.find((a: any) => a.id === accountId) || accounts[0];

  const accountsById = useMemo(() => {
    const map: Record<string, Account> = {};
    (state.accounts ?? []).forEach((a) => {
      map[a.id] = a;
    });
    return map;
  }, [state.accounts]);

  const accountTxs = useMemo(() => {
    if (!account?.id) return [];
    const id = account.id;
    return (txs ?? []).filter((t) => {
      if (t.type === 'transfer') {
        return (
          t.fromAccountId === id || t.toAccountId === id || t.accountId === id
        );
      }
      return t.accountId === id;
    });
  }, [txs, account?.id]);

  // Summary totals (transfers: subtract if from, add if to)
  const { income, expense, netFromTxs } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of accountTxs) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') income += amt;
      else if (t.type === 'expense') expense += amt;
      else if (t.type === 'transfer' && account) {
        if (t.fromAccountId === account.id) expense += amt;
        else if (t.toAccountId === account.id) income += amt;
      }
    }
    return { income, expense, netFromTxs: income - expense };
  }, [accountTxs, account]);

  const [showRunningBalance, setShowRunningBalance] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<Account['type']>('bank');
  const [editBalance, setEditBalance] = useState('0');
  const [editLimit, setEditLimit] = useState('');
  const [editColor, setEditColor] = useState<string>('#3b82f6');
  const [editIcon, setEditIcon] = useState<string>('🏦');
  const [editMaturityEnabled, setEditMaturityEnabled] = useState(false);
  const [editMaturityDate, setEditMaturityDate] = useState(''); // YYYY-MM-DD
  const [editMaturityDays, setEditMaturityDays] = useState('60'); // string for TextInput/pills
  const [justArchived, setJustArchived] = useState(false);

  const COLOR_CHOICES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];
  const ICON_CHOICES = ['🏦', '💳', '💰', '🏠', '🚗', '🧾', '🎯', '🧳'];

  // Treat account.balance as OPENING balance for the account
  const openingBalance = useMemo(() => {
    const b = Number((account as any)?.balance);
    return Number.isFinite(b) ? b : 0;
  }, [account]);

  // Current balance = opening + netFromTxs
  const currentBalanceNow = useMemo(() => {
    return openingBalance + netFromTxs;
  }, [openingBalance, netFromTxs]);

  const limitValue = Number((account as any)?.limit);
  const hasLimit = Number.isFinite(limitValue) && limitValue > 0;

  type BalanceStatus = 'normal' | 'amber' | 'red';

  function getStatus(balance: number, limit?: number): BalanceStatus {
    const lim = Number(limit);
    const has = Number.isFinite(lim) && lim > 0;

    if (balance > 0) return 'normal';
    if (!has) return 'amber';
    if (balance < -lim) return 'red';
    return 'amber';
  }

  const statusNow: BalanceStatus = getStatus(currentBalanceNow, hasLimit ? limitValue : undefined);

  const statusTextStyle =
    statusNow === 'red'
      ? styles.statusRed
      : statusNow === 'amber'
        ? styles.statusAmber
        : styles.statusNormal;

  const statusLabel =
    statusNow === 'red'
      ? `Over agreed ${account?.type === 'credit' ? 'credit limit' : 'overdraft'}`
      : statusNow === 'amber' && currentBalanceNow < 0
        ? `Within agreed ${account?.type === 'credit' ? 'credit limit' : 'overdraft'}`
        : 'In credit';

  /**
   * Forward-running balance (chronological, safe for imports)
   */
  const balanceAfterMap = useMemo(() => {
    if (!account) return {};

    const asc = [...accountTxs].sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      const d = da.localeCompare(db); // oldest first
      if (d !== 0) return d;
      return String(a.id).localeCompare(String(b.id));
    });

    let running = openingBalance;

    const map: Record<string, number> = {};
    for (const t of asc) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') running += amt;
      else if (t.type === 'expense') running -= amt;
      else if (t.type === 'transfer' && account) {
        if (t.fromAccountId === account.id) running -= amt;
        else if (t.toAccountId === account.id) running += amt;
      }

      map[t.id] = running; // Balance AFTER this txn
    }

    return map;
  }, [account, accountTxs, openingBalance]);


  // Display newest-first
  const displayTxs = useMemo(() => {
    const copy = [...accountTxs];
    copy.sort((a, b) => {
      const da = String(a.date || '');
      const db = String(b.date || '');
      const d = db.localeCompare(da);
      if (d !== 0) return d;
      return String(b.id).localeCompare(String(a.id));
    });
    return copy;
  }, [accountTxs]);

  const handleQuickAdd = (type: 'income' | 'expense') => {
    if (!account) return;
    navigation.navigate('TxnEditor', { accountId: account.id, type });
  };

  const handleTransfer = () => {
    if (!account) return;
    navigation.navigate('Transfer', { fromAccountId: account.id });
  };

  const handleEditTxn = (id: string) => {
    navigation.navigate('TxnEditor', { id });
  };

  const openEdit = (acc: Account) => {
    if (acc.archived) {
      Alert.alert('Archived account', 'Unarchive the account before editing.');
      return;
    }
    setEditingAccount(acc);
    setEditName(acc.name ?? '');
    setEditType(acc.type ?? 'bank');

    const b = Number((acc as any)?.balance);
    setEditBalance(Number.isFinite(b) ? String(b) : '0');

    const lim = Number((acc as any)?.limit);
    setEditLimit(Number.isFinite(lim) && lim > 0 ? String(lim) : '');

    setEditColor(acc.color ?? '#3b82f6');
    setEditIcon(acc.icon ?? '🏦');
    setEditMaturityEnabled(!!(acc as any).maturityReminderEnabled);
    setEditMaturityDate(String((acc as any).maturityDate || ''));
    setEditMaturityDays(String((acc as any).maturityReminderDays ?? 60));
  };

  const saveEdit = async () => {
    if (!editingAccount) return;

    const trimmed = editName.trim();
    if (trimmed.length < 2) {
      Alert.alert('Invalid name', 'Account name must be at least 2 characters.');
      return;
    }

    const duplicate = accounts.some(
      (a) => a.name.toLowerCase() === trimmed.toLowerCase() && a.id !== editingAccount.id
    );
    if (duplicate) {
      Alert.alert('Duplicate name', 'An account with this name already exists.');
      return;
    }

    const parsed = Number(String(editBalance).replace(/,/g, '').trim());
    if (!Number.isFinite(parsed)) {
      Alert.alert('Invalid balance', 'Opening balance must be a number.');
      return;
    }

    const limitRaw = String(editLimit ?? '').replace(/,/g, '').trim();
    let parsedLimit: number | undefined = undefined;

    if (limitRaw !== '') {
      const n = Number(limitRaw);
      if (!Number.isFinite(n) || n < 0) {
        Alert.alert('Invalid limit', 'Limit must be a positive number (or left blank).');
        return;
      }
      parsedLimit = n === 0 ? undefined : n;
    }

    const maturityEnabled = !!editMaturityEnabled;
    const maturityDate = editMaturityDate.trim();
    const maturityDaysNum = Number(String(editMaturityDays).trim());

    if (maturityEnabled) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(maturityDate)) {
        Alert.alert('Invalid maturity date', 'Use YYYY-MM-DD (e.g. 2026-06-30).');
        return;
      }
      if (!Number.isFinite(maturityDaysNum) || maturityDaysNum <= 0) {
        Alert.alert('Invalid reminder window', 'Reminder days must be a positive number.');
        return;
      }
    }

    const oldEnabled = !!(editingAccount as any)?.maturityReminderEnabled;
    const oldDate = String((editingAccount as any)?.maturityDate || '').trim();
    const newEnabled = !!editMaturityEnabled;
    const newDate = editMaturityDate.trim();
    const shouldClearDismissal =
      (newEnabled && !oldEnabled) || (newEnabled && !!newDate && newDate !== oldDate);

    actions.updateAccount(editingAccount.id, {
      name: trimmed,
      type: editType,
      balance: parsed,
      color: editColor,
      icon: editIcon,
      limit: parsedLimit,

      maturityReminderEnabled: maturityEnabled,
      maturityDate: maturityEnabled ? maturityDate : undefined,
      maturityReminderDays: maturityEnabled
        ? (Number.isFinite(maturityDaysNum) ? maturityDaysNum : 60)
        : undefined,

      maturityReminderDismissedFor: shouldClearDismissal
        ? undefined
        : (editingAccount as any).maturityReminderDismissedFor,
    });

    navigation.setOptions({ title: `${editIcon ? `${editIcon} ` : ''}${trimmed}` });
    setEditingAccount(null);
    setEditName('');
    setEditBalance('0');
    setEditLimit('');
    setEditType('bank');
    setEditColor('#3b82f6');
    setEditIcon('🏦');
    setEditMaturityEnabled(false);
    setEditMaturityDate('');
    setEditMaturityDays('60');
  };

  const toggleArchive = () => {
    if (!account) return;

    const next = !account.archived;
    const label = next ? 'Archive' : 'Unarchive';

    Alert.alert(
      `${label} "${account.name}"?`,
      next
        ? 'Archived accounts are hidden from lists but still included in totals.'
        : 'This account will appear again in lists.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: 'default',
          onPress: () => {
            actions.updateAccount(account.id, { archived: next });
          },
        },
      ]
    );
  };

  const onDeleteAccount = () => {
    if (!account) return;

    if (Math.round(currentBalanceNow * 100) !== 0) {
      Alert.alert(
        "Can't delete",
        "You can't delete an account with a non-zero balance. Clear it first (transfer out or add an adjustment)."
      );
      return;
    }

    const linkedRecurring = recurring.filter(
      (r) =>
        r.accountId === account.id ||
        r.fromAccountId === account.id ||
        r.toAccountId === account.id
    );
    const hasLinkedHistory = accountTxs.length > 0 || linkedRecurring.length > 0;

    if (hasLinkedHistory) {
      Alert.alert(
        `Delete "${account.name}"?`,
        'This account has history (transactions and/or recurring items). Archive it instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'default',
            onPress: () => {
              actions.updateAccount(account.id, { archived: true });
              setJustArchived(true);
            },
          },
          {
            text: 'Delete account + all linked transactions',
            style: 'destructive',
            onPress: () => {
              actions.deleteAccount(account.id);
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Delete "${account.name}"?`,
      'This will delete the account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            actions.deleteAccount(account.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const maturityInfo = useMemo(() => {
    const enabled = !!(account as any)?.maturityReminderEnabled;
    const date = String((account as any)?.maturityDate || '').trim();
    if (!enabled || !date) return null;

    const d = daysUntilYMD(date);
    if (d == null) return { line1: 'Maturity: invalid date', line2: 'Use YYYY-MM-DD' };

    const lead = Number.isFinite((account as any)?.maturityReminderDays)
      ? Number((account as any)?.maturityReminderDays)
      : 60;

    const when =
      d < 0
        ? `Date passed (${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago)`
        : d === 0
          ? 'Today'
          : `In ${d} day${d === 1 ? '' : 's'}`;

    return {
      line1: `Maturity: ${date} (${when})`,
      line2: `Reminder: ${lead} day${lead === 1 ? '' : 's'} before`,
    };
  }, [account]);

  if (!account) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.h1}>Account</Text>
        <Text style={styles.subtle}>
          No accounts found. Add one from the Dashboard.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {justArchived && account?.archived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>Account archived</Text>
          <Pressable
            style={styles.archivedBannerBtn}
            onPress={() => navigation.navigate('Dashboard')}
          >
            <Text style={styles.archivedBannerBtnText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.headerRow}>
        <Text style={styles.h1}>
              {(account.icon ? `${account.icon} ` : '') + (account.name || 'Account')}
            </Text>
        <Pressable
          style={styles.editButton}
          onPress={() => openEdit(account)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      </View>
      <Text style={styles.subtle}>Overview for this account.</Text>

      {maturityInfo ? (
        <View style={styles.maturityBlock}>
          <Text style={styles.maturityLine1}>{maturityInfo.line1}</Text>
          <Text style={styles.maturityLine2}>{maturityInfo.line2}</Text>
        </View>
      ) : null}

      {/* Edit account modal */}
      <Modal
        visible={!!editingAccount}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingAccount(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setEditingAccount(null)}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>Account settings</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Account name"
              placeholderTextColor="#7b7b7b"
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            <Text style={styles.modalLabel}>Opening balance</Text>
            <TextInput
              style={styles.modalInput}
              value={editBalance}
              onChangeText={setEditBalance}
              placeholder="0"
              placeholderTextColor="#7b7b7b"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            <Text style={styles.modalLabel}>
              {editType === 'credit' ? 'Credit limit (optional)' : 'Overdraft limit (optional)'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editLimit}
              onChangeText={setEditLimit}
              placeholder={editType === 'credit' ? 'e.g. 2500' : 'e.g. 500'}
              placeholderTextColor="#7b7b7b"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />
            <Text style={styles.modalHint}>
              Used for warnings when a transfer takes the account beyond the agreed limit.
            </Text>
            <Text style={styles.modalLabel}>Account type</Text>
            <View style={styles.typeRow}>
              {(['bank', 'credit', 'cash', 'other'] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typePill, editType === t && styles.typePillActive]}
                  onPress={() => setEditType(t)}
                >
                  <Text style={[styles.typePillText, editType === t && styles.typePillTextActive]}>
                    {t.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>Icon</Text>
            <View style={styles.choiceRow}>
              {ICON_CHOICES.map((ic) => (
                <Pressable
                  key={ic}
                  style={[styles.choicePill, editIcon === ic && styles.choicePillActive]}
                  onPress={() => setEditIcon(ic)}
                >
                  <Text style={styles.choiceText}>{ic}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.modalLabel}>Color</Text>
            <View style={styles.choiceRow}>
              {COLOR_CHOICES.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    editColor === c && styles.colorDotActive,
                  ]}
                  onPress={() => setEditColor(c)}
                />
              ))}
            </View>

            <View style={{ marginTop: 6 }}>
              <Text style={styles.modalTitle}> </Text>
              <Text style={styles.modalLabel}>Investment reminders</Text>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Enable maturity reminder</Text>
                <Switch
                  value={editMaturityEnabled}
                  onValueChange={setEditMaturityEnabled}
                  trackColor={{ false: '#222', true: '#3ddc84' }}
                  thumbColor="#fff"
                />
              </View>

              {editMaturityEnabled ? (
                <>
                  <Text style={styles.modalLabel}>Maturity date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editMaturityDate}
                    onChangeText={setEditMaturityDate}
                    placeholder="2026-06-30"
                    placeholderTextColor="#7b7b7b"
                    autoCorrect={false}
                  />
                  {editMaturityEnabled && editMaturityDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(editMaturityDate.trim()) ? (
                    <Text style={[styles.modalHint, { color: theme.negative, marginTop: 4 }]}>
                      Use YYYY-MM-DD format
                    </Text>
                  ) : null}

                  <Text style={styles.modalLabel}>Remind me (days before)</Text>
                  <View style={styles.typeRow}>
                    {['30', '45', '60', '90'].map((d) => (
                      <Pressable
                        key={d}
                        style={[styles.typePill, editMaturityDays === d && styles.typePillActive]}
                        onPress={() => setEditMaturityDays(d)}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            editMaturityDays === d && styles.typePillTextActive,
                          ]}
                        >
                          {d}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.modalHint}>
                    You'll see a warning on the Dashboard when the account is within this window.
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setEditingAccount(null);
                  setEditName('');
                  setEditBalance('0');
                  setEditLimit('');
                  setEditType('bank');
                  setEditColor('#3b82f6');
                  setEditIcon('🏦');
                  setEditMaturityEnabled(false);
                  setEditMaturityDate('');
                  setEditMaturityDays('60');
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={saveEdit}
              >
                <Text style={styles.modalBtnSaveText}>Save</Text>
              </Pressable>
            </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current balance</Text>

          <Text style={[styles.summaryValue, statusTextStyle]}>
            £{currentBalanceNow.toFixed(2)}
          </Text>

          {hasLimit ? (
            <Text style={styles.summaryMeta}>
              {account.type === 'credit'
                ? `Credit limit: £${limitValue.toFixed(2)}`
                : `Agreed overdraft: £${limitValue.toFixed(2)}`}
            </Text>
          ) : null}

          <Text style={[styles.summaryMeta, statusTextStyle]}>
            Status: {statusLabel}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Income / Spending</Text>
          <Text style={[styles.summaryValue, styles.incomeText]}>
            +£{income.toFixed(2)}
          </Text>
          <Text style={[styles.summaryValue, styles.expenseText]}>
            -£{expense.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Quick add */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickButton, styles.quickIncome]}
          onPress={() => handleQuickAdd('income')}
        >
          <Text style={styles.quickText}>Add income</Text>
        </Pressable>

        <Pressable
          style={[styles.quickButton, styles.quickExpense]}
          onPress={() => handleQuickAdd('expense')}
        >
          <Text style={styles.quickText}>Add expense</Text>
        </Pressable>
      </View>

      {/* Transfer */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickButton, styles.quickTransfer]}
          onPress={handleTransfer}
        >
          <Text style={styles.quickText}>Transfer</Text>
        </Pressable>
      </View>

      <View style={styles.sectionDivider} />

      {/* Running balance toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show running balance</Text>
        <Switch
          value={showRunningBalance}
          onValueChange={setShowRunningBalance}
          trackColor={{ false: '#222', true: '#3ddc84' }}
          thumbColor="#fff"
        />
      </View>


      {/* Transactions */}
      <Text style={styles.sectionTitle}>Transactions</Text>

      {displayTxs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyText}>
            Add income or expenses to see them listed here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayTxs}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const signed = getSignedAmountForAccount(item, account?.id);
            const sign = signed > 0 ? '+' : signed < 0 ? '-' : '';
            const isTransferTx = isTransfer(item);
            const { label, note } =
              isTransferTx && account?.id
                ? getTransferLabelAndNoteForAccount(item, account.id, accountsById)
                : {
                    label: item.category || 'Uncategorised',
                    note: item.description || '',
                  };
            const balAfter = balanceAfterMap[item.id];

            return (
              <Pressable
                style={styles.txRow}
                onPress={() => handleEditTxn(item.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txLabel}>{label}</Text>
                  {note ? <Text style={styles.txNote}>{note}</Text> : null}
                  {item.date ? <Text style={styles.txMeta}>{item.date}</Text> : null}
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.txAmount,
                      signed > 0
                        ? styles.incomeText
                        : signed < 0
                          ? styles.expenseText
                          : undefined,
                    ]}
                  >
                    {sign}£{Math.abs(signed).toFixed(2)}
                  </Text>

                  {showRunningBalance ? (
                    <Text style={styles.txBalanceAfter}>
                      Balance £{Number(balAfter ?? currentBalanceNow).toFixed(2)}
                    </Text>
                  ) : null}

                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable onPress={toggleArchive} style={styles.archiveButton}>
        <Text style={styles.archiveButtonText}>
          {account.archived ? 'Unarchive account' : 'Archive account'}
        </Text>
      </Pressable>

      <Pressable onPress={onDeleteAccount} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Delete account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 35,
    backgroundColor: theme.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  h1: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
  },
  editButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  editButtonText: {
    color: theme.link,
    fontWeight: '800',
    fontSize: 14,
  },
  maturityBlock: {
    marginTop: -6,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.cardAlt,
  },
  maturityLine1: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 13,
  },
  maturityLine2: {
    marginTop: 4,
    color: theme.textDim,
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: theme.cardAlt,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  modalLabel: {
    color: '#fff',
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 6,
    opacity: 0.9,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.text,
    marginBottom: 16,
    fontSize: 16,
  },
  modalHint: {
    color: theme.textDim,
    fontSize: 12,
    marginTop: -10,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  modalBtnCancel: {
    backgroundColor: 'transparent',
  },
  modalBtnCancelText: {
    color: theme.textDim,
    fontWeight: '800',
  },
  modalBtnSave: {
    backgroundColor: theme.link,
  },
  modalBtnSaveText: {
    color: '#fff',
    fontWeight: '800',
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  typePillActive: {
    borderColor: theme.link,
  },
  typePillText: {
    color: theme.textDim,
    fontWeight: '800',
    fontSize: 12,
  },
  typePillTextActive: {
    color: '#fff',
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  choicePillActive: {
    borderColor: theme.link,
  },
  choiceText: {
    fontSize: 16,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#fff',
  },
  archiveButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  archiveButtonText: {
    color: '#60a5fa',
    fontWeight: '800',
  },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: theme.cardAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.link,
  },
  archivedBannerText: {
    color: theme.text,
    fontWeight: '800',
    fontSize: 14,
  },
  archivedBannerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  archivedBannerBtnText: {
    color: theme.link,
    fontWeight: '800',
    fontSize: 14,
  },
  subtle: {
    opacity: 0.8,
    marginBottom: 14,
    color: '#fff',
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: theme.cardAlt,
  },
  summaryLabel: {
    opacity: 0.8,
    marginBottom: 6,
    color: '#fff',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  summaryMeta: {
    marginTop: 6,
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  statusNormal: { color: theme.text },
  statusAmber: { color: '#F59E0B' },
  statusRed: { color: theme.negative },

  incomeText: {
    color: '#3ddc84',
  },
  expenseText: {
    color: '#ff6b6b',
  },

  quickRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quickButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: theme.cardAlt,
  },
  quickIncome: {},
  quickExpense: {},
  quickTransfer: {
    flex: 1,
  },
  quickText: {
    fontWeight: '700',
    color: '#fff',
  },

  sectionDivider: {
    height: 1,
    opacity: 0.2,
    marginVertical: 12,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    color: '#fff',
  },

  emptyBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#222',
    backgroundColor: theme.cardAlt,
  },
  emptyTitle: {
    fontWeight: '800',
    marginBottom: 6,
    color: '#fff',
  },
  emptyText: {
    opacity: 0.85,
    color: '#fff',
  },

  txRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222',
  },
  txLabel: {
    fontWeight: '800',
    marginBottom: 2,
    color: '#fff',
  },
  txNote: {
    opacity: 0.85,
    marginBottom: 2,
    color: '#fff',
  },
  txMeta: {
    opacity: 0.7,
    fontSize: 12,
    color: '#fff',
  },
  txAmount: {
    fontWeight: '800',
    fontSize: 16,
  },
  txBalanceAfter: {
    marginTop: 4,
    opacity: 0.75,
    fontSize: 12,
    color: '#fff',
  },
    toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  toggleLabel: {
    color: '#fff',
    fontWeight: '700',
    opacity: 0.9,
  },

  deleteButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteButtonText: {
    color: '#ef4444',
    fontWeight: '800',
  },

});
