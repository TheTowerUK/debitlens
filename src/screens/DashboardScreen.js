import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useApp } from '../state/AppState';

export default function DashboardScreen({ navigation }) {
  const { accounts, balanceOf, createAccount } = useApp();
  const [newName, setNewName] = useState('');

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + balanceOf(a.id), 0),
    [accounts, balanceOf]
  );

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.h1}>Dashboard</Text>
      <Text style={styles.total}>Total balance: £{totalBalance.toFixed(2)}</Text>

      <View style={{ height: 12 }} />

      {accounts.map(a => {
        const bal = balanceOf(a.id);
        return (
          <Pressable key={a.id} style={styles.card} onPress={() => navigation.navigate('Account', { accountId: a.id })}>
            <Text style={styles.cardTitle}>{a.name}</Text>
            <Text style={[styles.amount, { color: bal < 0 ? '#F87171' : '#34D399' }]}>
              £{Math.abs(bal).toFixed(2)}
            </Text>
          </Pressable>
        );
      })}

      <View style={{ height: 16 }} />
      <Text style={styles.h2}>Add Account</Text>
      <TextInput
        value={newName}
        onChangeText={setNewName}
        placeholder="Account name"
        placeholderTextColor="#6B7280"
        style={styles.input}
      />
      <Pressable
        style={styles.primary}
        onPress={() => {
          if (!newName.trim()) return;
          createAccount(newName.trim(), '£');
          setNewName('');
        }}
      >
        <Text style={styles.primaryText}>Create</Text>
      </Pressable>

      <Pressable style={styles.outline} onPress={() => navigation.navigate('Reports')}>
        <Text style={styles.outlineText}>Reports (coming soon)</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{ flex:1, backgroundColor:'#0B0D13', padding:16 },
  h1:{ color:'#fff', fontSize:28, fontWeight:'700' },
  h2:{ color:'#fff', fontSize:18, fontWeight:'700', marginBottom:8, marginTop:8 },
  total:{ color:'#9CA3AF', marginTop:4 },
  card:{ backgroundColor:'#111827', borderColor:'#1F2937', borderWidth:1, borderRadius:14, padding:16, marginTop:10 },
  cardTitle:{ color:'#fff', fontSize:16, fontWeight:'700' },
  amount:{ marginTop:6, fontSize:20, fontWeight:'800' },
  input:{ backgroundColor:'#0F172A', color:'#fff', borderColor:'#1F2937', borderWidth:1, borderRadius:10, padding:12, marginBottom:8 },
  primary:{ backgroundColor:'#2563EB', borderRadius:10, paddingVertical:12, alignItems:'center' },
  primaryText:{ color:'#fff', fontWeight:'700' },
  outline:{ borderColor:'#1F2937', borderWidth:1, borderRadius:10, paddingVertical:12, alignItems:'center', marginTop:8 },
  outlineText:{ color:'#fff', fontWeight:'600' }
});
