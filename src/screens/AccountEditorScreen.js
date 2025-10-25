// src/screens/AccountEditorScreen.js
import React from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { upsertAccount } from '../services/accounts';

export default function AccountEditorScreen({ navigation }) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: 'New Account' });
  }, [navigation]);

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required'); return; }
    setBusy(true);
    try {
      // simple id — avoid adding new deps
      const id = 'acc_' + Date.now();
      await upsertAccount({ id, name: trimmed, type: type.trim() || null });
      navigation.replace('Account', { accountId: id });
    } catch (e) {
      console.warn('save account error', e);
      Alert.alert('Error', String(e?.message || e));
    } finally {
      setBusy(false);
    }
    navigation.replace('Account', { accountId: id });

  };

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'700', marginBottom:8 }}>Create Account</Text>

      <Text style={{ color:'#9CA3AF', marginBottom:6 }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Main, Savings, Credit Card"
        style={{ borderWidth:1, borderRadius:10, padding:12, marginBottom:12 }}
      />

      <Text style={{ color:'#9CA3AF', marginBottom:6 }}>Type (optional)</Text>
      <TextInput
        value={type}
        onChangeText={setType}
        placeholder="e.g. bank, card, cash"
        style={{ borderWidth:1, borderRadius:10, padding:12, marginBottom:16 }}
      />

      <Pressable
        onPress={onSave}
        disabled={busy}
        style={{ backgroundColor:'#2563EB', padding:12, borderRadius:10, alignItems:'center' }}
      >
        <Text style={{ color:'#fff', fontWeight:'700' }}>{busy ? 'Saving…' : 'Save account'}</Text>
      </Pressable>
    </View>
  );
}
