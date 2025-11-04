// src/screens/DashboardScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import ActionFab from '../components/ActionFab';
import { upsertAccount } from '../services/accounts';
import type { JSX } from 'react';
import type { RootStackParamList } from '../navigations/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props): JSX.Element {
  const { state, selectors, actions } = useApp();

  const accounts = state?.accounts ?? [];
  const txns = state?.transactions ?? [];

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, a) => sum + selectors.accountBalance(a.id), 0);
  }, [accounts, state?.transactions]);

  const positiveTrend = totalBalance >= 0;

  const handleAddAccount = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = 'acc_' + Date.now();
      await upsertAccount({ id, name });
      setAdding(false);
      setNewName('');
      navigation.replace('Account', { accountId: id });
    } catch (e) {
      console.warn('add account failed', e);
      alert('Could not create account');
    }
  };

  const onLogout = async () => {
    await actions.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
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

      {/* ACCOUNTS */}
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }}>
        {accounts.map((a) => {
          const bal = selectors.accountBalance(a.id);
          const accountTxns = txns
            .filter((t) => t.accountId === a.id)
            .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
          const lastTx = accountTxns[0] || null;
          const lastDate = lastTx?.date ? new Date(`${lastTx.date}T00:00:00`) : null;

          return (
            <Pressable
              key={String(a.id)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
              onPress={() => navigation.navigate('Account', { accountId: a.id })}
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
                  {(lastTx.note || lastTx.category || '—') +
                    (lastDate ? ` · ${lastDate.toLocaleDateString()}` : '')}
                </Text>
              ) : (
                <Text style={styles.lastTxEmpty}>No transactions yet</Text>
              )}
            </Pressable>
          );
        })}

        {/* ADD ACCOUNT */}
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

      {/* ACTION MENU */}
      <ActionFab
        items={[
          { key: 'add-account', label: 'Add Account', onPress: () => setAdding(true) },
          { key: 'history', label: 'History', onPress: () => navigation.navigate('History') },
          { key: 'reports', label: 'Reports', onPress: () => navigation.navigate('Reports') },
          { key: 'budgets', label: 'Budgets', onPress: () => navigation.navigate('Budgets') },
          { key: 'notifications', label: 'Notifications', onPress: () => navigation.navigate('Notifications') },
          { key: 'recurring', label: 'Recurring', onPress: () => navigation.navigate('Recurring') },
        ]}
        footer={{ label: 'Settings', onPress: () => navigation.navigate('Settings') }}
      />
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
  scroll: { flex: 1 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  balance: { fontSize: 18, fontWeight: '800' },
  lastTx: { color: '#9CA3AF', fontSize: 13, marginTop: 6 },
  lastTxEmpty: { color: '#6B7280', fontSize: 13, marginTop: 6 },
  addBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  addLabel: { color: '#9CA3AF', marginBottom: 8 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
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
});
