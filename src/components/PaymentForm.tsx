import { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';

export default function PaymentForm({ onSubmit }) {
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');

  const submit = () => {
    const value = parseFloat(amount);
    if (!payee.trim()) return Alert.alert('Missing payee', 'Please enter a payee name.');
    if (Number.isNaN(value) || value <= 0) return Alert.alert('Invalid amount', 'Enter a positive number.');
    onSubmit?.({ payee: payee.trim(), amount: value });
    setPayee(''); setAmount('');
  };

  return (
    <View style={{
      backgroundColor: theme.cardAlt,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border
    }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
        New Payment
      </Text>

      <Text style={{ color: theme.textDim }}>Payee</Text>
      <TextInput
        placeholder="e.g., John Smith"
        placeholderTextColor="#6B7280"
        value={payee}
        onChangeText={setPayee}
        style={{
          backgroundColor: '#0F172A',
          color: 'white',
          padding: 12, borderRadius: 8, marginTop: 6, marginBottom: 12
        }}
      />

      <Text style={{ color: theme.textDim }}>Amount (£)</Text>
      <TextInput
        placeholder="0.00"
        placeholderTextColor="#6B7280"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: '#0F172A',
          color: 'white',
          padding: 12, borderRadius: 8, marginTop: 6, marginBottom: 16
        }}
      />

      <Button title="Send Payment" onPress={submit} />
    </View>
  );
}
