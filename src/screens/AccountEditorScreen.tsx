// src/screens/AccountEditorScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useApp } from '../state/AppProvider';
import AccountForm from '../components/AccountForm';

export default function AccountEditorScreen({ navigation, route }) {
  const { state, actions } = useApp();
  const { accountId } = route.params ?? {};
  const isEditing = !!accountId;

  const [name, setName] = useState('');
  const [type, setType] = useState(''); // kept for AccountForm compatibility
  const [busy, setBusy] = useState(false);

  // Set header title
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Account' : 'New Account' });
  }, [navigation, isEditing]);

  // Load existing account when editing
  useEffect(() => {
    if (!isEditing) return;

    const acct = (state.accounts || []).find(a => a.id === accountId);
    if (acct) {
      setName(acct.name || '');
      // We don't store "type" in AppState; leave it blank or derive later if needed
      setType('');
    }
  }, [isEditing, accountId, state.accounts]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter an account name.');
      return;
    }

    setBusy(true);
    try {
      if (isEditing && accountId) {
        // Rename existing account
        actions.updateAccount(accountId, { name: trimmed });
        navigation.replace('Account', { accountId });
      } else {
        // Create new account
        const account = actions.addAccount(trimmed);
        navigation.replace('Account', { accountId: account.id });
      }
    } catch (e) {
      console.warn('save account error', e);
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
        {isEditing ? 'Edit Account' : 'Create Account'}
      </Text>

      {busy && (
        <ActivityIndicator
          size="small"
          color="#93C5FD"
          style={{ marginBottom: 12 }}
        />
      )}

      <AccountForm
        name={name}
        type={type}
        setName={setName}
        setType={setType}
        onSave={onSave}
        onCancel={() => navigation.goBack()}
      />
    </View>
  );
}
