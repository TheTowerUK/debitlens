import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useApp } from '../state/AppState';

export default function AccountScreen({ route, navigation }) {
  const { accountId } = route.params;
  const { getAccount, addTransaction, removeTransaction } = useApp();
  const account = getAccount(accountId);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const transactions = useMemo(() =>
    (account?.transactions ?? []).slice().sort((a,b)=>b.ts - a.ts),
    [account?.transactions]
  );

  if (!account) {
    return (
      <View style={styles.page}><Text style={styles.err}>Account not found.</Text></View>
    );
  }

  const submit = () => {
    const v = parseFloat(amount);
    if (Number.isNaN(v) || v === 0) return;
    addTransaction(account.id, { amount: v, note });
    setAmount(''); setNote('');
  };

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.h1}>{account.name}</Text>

      <Text style={styles.h2}>Add / Remove Payment</Text>
      <TextInput
        value={amount} onChangeText={setAmount}
        placeholder="Amount (use negative for outgoing)" placeholderTextColor="#6B7280" keyboardType="decimal-pad" style={styles.input}
      />
      <TextInput
        value={note} onChangeText={setNote}
        placeholder="Note (optional)" placeholderTextColor="#6B7280" style={styles.input}
      />
      <Pressable style={styles.primary} onPress={submit}>
        <Text style={styles.primaryText}>Add Transaction</Text>
      </Pressable>

      <View style={{ height: 16 }} />
      <Text style={styles.h2}>Transactions</Text>

      {transactions.map(tx => (
        <View key={tx.id} style={styles.row}>
          <View>
            <Text style={styles.note}>{tx.note || 'Transaction'}</Text>
            <Text style={styles.time}>{new Date(tx.ts).toLocaleString()}</Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={[styles.amount, { color: tx.amount < 0 ? '#F87171' : '#34D399' }]}>
              £{Math.abs(tx.amount).toFixed(2)}
            </Text>
            <Pressable style={styles.remove} onPress={() => removeTransaction(account.id, tx.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.outline} onPress={() => navigation.goBack()}>
        <Text style={styles.outlineText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{ flex:1, backgroundColor:'#0B0D13', padding:16 },
  h1:{ color:'#fff', fontSize:24, fontWeight:'700', marginBottom:8 },
  h2:{ color:'#fff', fontSize:18, fontWeight:'700', marginTop:8, marginBottom:8 },
  input:{ backgroundColor:'#0F172A', color:'#fff', borderColor:'#1F2937', borderWidth:1, borderRadius:10, padding:12, marginBottom:8 },
  primary:{ backgroundColor:'#2563EB', borderRadius:10, paddingVertical:12, alignItems:'center' },
  primaryText:{ color:'#fff', fontWeight:'700' },
  row:{ backgroundColor:'#111827', borderColor:'#1F2937', borderWidth:1, borderRadius:12, padding:12, marginBottom:8, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  note:{ color:'#fff', fontWeight:'700' },
  time:{ color:'#9CA3AF', marginTop:2, fontSize:12 },
  amount:{ fontWeight:'800', fontSize:16, textAlign:'right' },
  remove:{ marginTop:6, paddingVertical:4, paddingHorizontal:10, borderRadius:8, borderWidth:1, borderColor:'#374151' },
  removeText:{ color:'#9CA3AF', fontSize:12 },
  rowRight:{ alignItems:'flex-end' },
  outline:{ borderColor:'#1F2937', borderWidth:1, borderRadius:10, paddingVertical:12, alignItems:'center', marginTop:8 },
  outlineText:{ color:'#fff', fontWeight:'600' },
  err:{ color:'#fff', padding:16 }
});
