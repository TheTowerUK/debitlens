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
  const { state, actions } = useApp();
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
      const account = await actions.addAccount(name);
      setNewName('');
      setAdding(false);
      // In future, we can navigate to an Account screen with account.id
      // navigation.navigate('Account', { accountId: account.id });
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

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.subtle}>Accounts are stored locally on this device.</Text>

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

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
        {accounts.length === 0 && !adding && (
          <Text style={styles.empty}>No accounts yet. Tap “Add” to create one.</Text>
        )}

        {accounts.map(a => (
          <View key={a.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{a.name}</Text>
              <Pressable
                style={styles.deletePill}
                onPress={() => handleDeleteAccount(a.id)}
              >
                <Text style={styles.deletePillText}>Delete</Text>
              </Pressable>
            </View>
            <Text style={styles.cardSub}>
              Created {new Date(a.createdAt).toLocaleString()}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
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
  deletePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  deletePillText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
  cardSub: { color: '#9CA3AF', fontSize: 12, marginTop: 4 },

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
