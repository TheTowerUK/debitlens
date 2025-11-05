// src/screens/DashboardScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import { useApp } from '../state/AppProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const { state, actions, selectors } = useApp();
  const accounts = state.accounts || [];

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAddAccount = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter an account name.');
      return;
    }
    try {
      await actions.addAccount(name);
      setNewName('');
      setAdding(false);
    } catch (e: any) {
      console.warn('addAccount failed', e);
      Alert.alert('Error', e?.message || 'Could not create account');
    }
  };

  const handleDeleteAccount = async (id: string) => {
    Alert.alert('Delete account', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await actions.deleteAccount(id);
          } catch (e) {
            console.warn('deleteAccount failed', e);
            Alert.alert('Error', 'Could not delete account');
          }
        },
      },
    ]);
  };

  const handleAddSampleTx = async (accountId: string) => {
    try {
      await actions.addTransaction({
        accountId,
        amount: 10,
        type: 'income',
        note: 'Sample income',
      });
    } catch (e: any) {
      console.warn('addTransaction failed', e);
      Alert.alert('Error', e?.message || 'Could not add transaction');
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.subtle}>
        Accounts &amp; transactions are stored locally on this device.
      </Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <Pressable
          style={styles.smallBtn}
          onPress={() => setAdding(a => !a)}
        >
          <Text style={styles.smallBtnText}>{adding ? 'Cancel' : 'Add'}</Text>
        </Pressable>
      </View>

      {adding && (
        <View style={styles.addBox}>
          <Text style={styles.addLabel}>New account name</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Main account"
            placeholderTextColor="#6B7280"
            style={styles.input}
          />
          <Pressable style={styles.btnPrimary} onPress={handleAddAccount}>
            <Text style={styles.btnPrimaryText}>Save</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {accounts.length === 0 && !adding && (
          <Text style={styles.empty}>
            No accounts yet. Tap “Add” to create one.
          </Text>
        )}

        {accounts.map(a => {
          const balance = selectors.accountBalance(a.id);
          const txs = selectors.transactionsForAccount(a.id);
          return (
            <Pressable
              key={a.id}
              style={styles.card}
              onPress={() => navigation.navigate('Account', { accountId: a.id })}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.cardName}>{a.name}</Text>
                  <Text style={styles.cardSub}>
                    {txs.length} transaction{txs.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.balance,
                      { color: balance >= 0 ? '#34D399' : '#F87171' },
                    ]}
                  >
                    £{Math.abs(balance).toFixed(2)}
                  </Text>
                  <Pressable
                    style={styles.samplePill}
                    onPress={e => {
                      e.stopPropagation();
                      handleAddSampleTx(a.id);
                    }}
                  >
                    <Text style={styles.samplePillText}>+ £10 sample</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.cardBottom}>
                <Pressable
                  style={styles.deletePill}
                  onPress={e => {
                    e.stopPropagation();
                    handleDeleteAccount(a.id);
                  }}
                >
                  <Text style={styles.deletePillText}>Delete account</Text>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.footerBtnText}>History</Text>
        </Pressable>
          <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('Reports')}
        >
          <Text style={styles.footerBtnText}>Reports</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnPrimary]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.footerBtnText}>Settings</Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, styles.footerBtnGhost]}
          onPress={() => navigation.navigate('ImportCSV')}
        >
          <Text style={styles.footerBtnText}>Import CSV</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#0B0D13',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
  },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtle: { color: '#9CA3AF', marginBottom: 16 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  smallBtnText: { color: '#E5E7EB', fontWeight: '600' },

  addBox: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  addLabel: { color: '#9CA3AF', marginBottom: 6 },
  input: {
    backgroundColor: '#0F172A',
    color: '#fff',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700' },

  scroll: { flex: 1, marginTop: 12 },
  empty: { color: '#6B7280', marginTop: 8 },

  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardSub: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },
  balance: { fontSize: 18, fontWeight: '800' },

  samplePill: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  samplePillText: { color: '#BBF7D0', fontSize: 12, fontWeight: '600' },

  cardBottom: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  deletePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  deletePillText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  footerBtnPrimary: { backgroundColor: '#2563EB' },
  footerBtnGhost: { backgroundColor: '#1F2937' },
  footerBtnText: { color: '#fff', fontWeight: '700' },
});
