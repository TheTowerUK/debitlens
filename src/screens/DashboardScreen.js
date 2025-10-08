// src/screens/DashboardScreen.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useApp } from '../state/AppState';

export default function DashboardScreen({ navigation }) {
  const { state, selectors, actions } = useApp();
  const accounts = state.accounts ?? [];
  const transactions = state.transactions ?? [];

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + selectors.accountBalance(a.id), 0);
  }, [accounts, state.transactions, selectors]);

  const positiveTrend = totalBalance >= 0;

  // ----- Account CRUD -----
  const handleAddAccount = async () => {
    const name = newName.trim();
    if (!name) return;
    await actions.addAccount(name, 'current');
    setNewName('');
    setAdding(false);
  };

  const startEdit = (acc) => {
    setEditingId(acc.id);
    setEditName(acc.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async () => {
    const name = editName.trim();
    if (!name) return;
    const next = accounts.map(a => (a.id === editingId ? { ...a, name } : a));
    await actions.setAccounts(next);

    // keep existing txns' accountName in sync (optional, nice UX)
    const nextTxns = transactions.map(t =>
      t.accountId === editingId ? { ...t, accountName: name } : t
    );
    await actions.setTransactions(nextTxns);

    cancelEdit();
  };

  const confirmDelete = (acc) => {
    Alert.alert(
      'Delete account?',
      'This will also remove all transactions belonging to this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const nextAccounts = accounts.filter(a => a.id !== acc.id);
            await actions.setAccounts(nextAccounts);
            const nextTxns = transactions.filter(t => t.accountId !== acc.id);
            await actions.setTransactions(nextTxns);
          },
        },
      ]
    );
  };

  const onLogout = async () => {
    await actions.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      {/* HEADER SUMMARY */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Total Balance</Text>
          <Text
            style={[
              styles.total,
              { color: positiveTrend ? '#34D399' : '#F87171' },
            ]}
          >
            £{Math.abs(totalBalance).toFixed(2)}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.trend}>{positiveTrend ? '▲ Up' : '▼ Down'}</Text>
          <Pressable onPress={onLogout} hitSlop={8}>
            <Text style={styles.logout}>Logout</Text>
          </Pressable>
        </View>
      </View>

      {/* QUICK ACTIONS */}
      <View style={styles.actionsRow}>
        <Pressable style={[styles.btnSave, styles.actionBtn]} onPress={() => navigation.navigate('Report')}>
          <Text style={styles.btnText}>Reports</Text>
        </Pressable>
        <Pressable style={[styles.btnSave, styles.actionBtn]} onPress={() => navigation.navigate('History')}>
          <Text style={styles.btnText}>View History</Text>
        </Pressable>
        <Pressable style={[styles.btnSave, styles.actionBtn]} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.btnText}>Settings</Text>
        </Pressable>
        <Pressable style={[styles.btnSave, styles.actionBtn]} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.btnText}>Notifications</Text>
        </Pressable>
      </View>

      {/* ACCOUNTS LIST */}
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {accounts.map((a) => {
          const bal = selectors.accountBalance(a.id);
          const txs = transactions
            .filter((t) => t.accountId === a.id)
            .sort((x, y) => y.date.localeCompare(x.date)); // newest first

          const lastTx = txs[0] || null;
          const lastDate = lastTx ? new Date(`${lastTx.date}T00:00:00`) : null;
          const isEditing = editingId === a.id;

          return (
            <View key={a.id} style={{ marginBottom: 12 }}>
              <Pressable
                style={({ pressed }) => [styles.card, !isEditing && pressed ? styles.cardPressed : null]}
                onPress={() => {
                  if (isEditing) return;
                  navigation.navigate('Account', { accountId: a.id });
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{a.name}</Text>
                  <Text
                    style={[
                      styles.balance,
                      { color: bal < 0 ? '#F87171' : '#34D399' },
                    ]}
                  >
                    £{Math.abs(bal).toFixed(2)}
                  </Text>
                </View>

                {lastTx ? (
                  <Text style={styles.lastTx}>
                    {(lastTx.note || lastTx.category) + ' • ' + (lastDate ? lastDate.toLocaleDateString() : '')}
                  </Text>
                ) : (
                  <Text style={styles.lastTxEmpty}>No transactions yet</Text>
                )}

                {!isEditing && (
                  <View style={styles.cardActions}>
                    <Pressable style={[styles.btnTiny, { marginRight: 8 }]} onPress={() => startEdit(a)}>
                      <Text style={styles.btnTinyText}>Edit</Text>
                    </Pressable>
                    <Pressable style={styles.btnTinyDanger} onPress={() => confirmDelete(a)}>
                      <Text style={styles.btnTinyText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </Pressable>

              {isEditing && (
                <View style={styles.editBox}>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Account name"
                    placeholderTextColor="#6B7280"
                    style={styles.input}
                  />
                  <View style={styles.editRow}>
                    <Pressable style={styles.btnSave} onPress={saveEdit}>
                      <Text style={styles.btnText}>Save</Text>
                    </Pressable>
                    <Pressable style={styles.btnCancel} onPress={cancelEdit}>
                      <Text style={styles.btnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ADD ACCOUNT FORM */}
        {adding && (
          <View style={styles.addBox}>
            <Text style={styles.addLabel}>New Account Name</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Holiday Fund"
              placeholderTextColor="#6B7280"
              style={styles.input}
            />
            <View style={styles.addRow}>
              <Pressable style={styles.btnCancel} onPress={() => setAdding(false)}>
                <Text style={styles.btnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnSave} onPress={handleAddAccount}>
                <Text style={styles.btnText}>Add</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {!adding && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed ? styles.fabPressed : null]}
          onPress={() => {
            cancelEdit();
            setAdding(true);
          }}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0D13', paddingHorizontal: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  headerRight: { alignItems: 'flex-end' },
  heading: { color: '#9CA3AF', fontSize: 16 },
  total: { fontSize: 32, fontWeight: '800' },
  trend: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  logout: { color: '#93C5FD', marginTop: 6, fontWeight: '700' },

  // Quick actions (wrap)
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    marginRight: -8,
    // negative bottom margin to neutralize child bottom margins on last row:
    marginBottom: -8,
  },
  actionBtn: { marginRight: 8, marginBottom: 8, alignSelf: 'flex-start' },

  scroll: { flex: 1 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cardPressed: { opacity: 0.92 },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balance: { fontSize: 18, fontWeight: '800' },
  lastTx: { color: '#9CA3AF', fontSize: 13, marginTop: 6 },
  lastTxEmpty: { color: '#6B7280', fontSize: 13, marginTop: 6 },

  cardActions: { flexDirection: 'row', marginTop: 12 },
  btnTiny: { backgroundColor: '#1F2937', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  btnTinyDanger: { backgroundColor: '#7F1D1D', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginLeft: 8 },
  btnTinyText: { color: '#fff', fontWeight: '700' },

  editBox: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginTop: 8 },
  editRow: { flexDirection: 'row', justifyContent: 'space-between' },

  addBox: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 12 },
  addLabel: { color: '#9CA3AF', marginBottom: 8 },

  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  addRow: { flexDirection: 'row', justifyContent: 'space-between' },

  btnCancel: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  btnSave: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  btnText: { color: '#fff', fontWeight: '700' },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 28,
    backgroundColor: '#2563EB',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  fabText: { color: '#fff', fontSize: 36, marginTop: -2 },
});
