// src/screens/AccountEditorScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useApp } from '../state/AppProvider';
import AccountForm from '../components/AccountForm';

export default function AccountEditorScreen({ navigation, route }) {
  const { selectors, actions } = useApp();
  const { accountId } = route.params ?? {};
  const isEditing = !!accountId;

  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit Account' : 'New Account' });
  }, [navigation, isEditing]);

  React.useEffect(() => {
    if (isEditing) {
      const acct = selectors.getAccount(accountId);
      if (acct) {
        setName(acct.name);
        setType(acct.type ?? '');
      }
    }
  }, [accountId]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert('Name required');
    setBusy(true);
    try {
      const id = accountId || 'acc_' + Date.now();
      await actions.upsertAccount({ id, name: trimmed, type: type.trim() || null });
      navigation.replace('Account', { accountId: id });
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

      {busy && <ActivityIndicator size="small" color="#93C5FD" style={{ marginBottom: 12 }} />}

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
