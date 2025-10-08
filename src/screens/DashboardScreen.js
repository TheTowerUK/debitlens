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
} from 'react-native';
import { useApp } from '../state/AppState';

export default function DashboardScreen({ navigation }) {
  const { accounts, balanceOf, createAccount } = useApp();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // ---------- Derived totals ----------
  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + balanceOf(a.id), 0),
    [accounts, balanceOf]
  );

  const positiveTrend = totalBalance >= 0;

  const handleAddAccount = () => {
    if (!newName.trim()) return;
    createAccount(newName.trim(), '£');
    setNewName('');
    setAdding(false);
  };

  // ---------- UI ----------
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
        <Text style={styles.trend}>
          {positiveTrend ? '▲ Up' : '▼ Down'}
        </Text>
      </View>
  {/* QUICK ACTIONS */}
  <View style={styles.actionsRow}>
   <Pressable style={styles.btnSave} onPress={() => navigation.navigate('Report')}>
     <Text style={styles.btnText}>Reports</Text>
   </Pressable>

   <Pressable style={styles.btnSave} onPress={() => navigation.navigate('History')}>
     <Text style={styles.btnText}>View History</Text>
   </Pressable>
  </View>


      {/* ACCOUNTS LIST */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {accounts.map((a) => {
          const bal = balanceOf(a.id);
          const txs = a.transactions ?? [];
          const lastTx = txs.length
            ? txs.sort((x, y) => y.ts - x.ts)[0]
            : null;

          return (
            <Pressable
              key={a.id}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() =>
                navigation.navigate('Account', { accountId: a.id })
              }
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
                  {lastTx.note} ·{' '}
                  {new Date(lastTx.ts).toLocaleDateString()}
                </Text>
              ) : (
                <Text style={styles.lastTxEmpty}>No transactions yet</Text>
              )}
            </Pressable>
            
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

      {/* FLOATING ADD BUTTON */}
      {!adding && (
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => setAdding(true)}
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
  heading: { color: '#9CA3AF', fontSize: 16 },
  total: { fontSize: 32, fontWeight: '800' },
  trend: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
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
  fabText: { color: '#fff', fontSize: 36, marginTop: -2 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
// If RN version doesn't support `gap`, use:
// actionsRow: { flexDirection: 'row', marginBottom: 12 },
// and set `style={{ marginRight: 8 }}` on the first button.

});
