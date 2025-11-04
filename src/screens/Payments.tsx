import { View, Text, ScrollView } from 'react-native';
import PaymentForm from '../components/PaymentForm';
import PaymentCard from '../components/PaymentCard';
import { useApp } from '../state/AppProvider';

export default function Payments() {
  const { payments, addPayment } = useApp();

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#0B0D13' }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '600', marginBottom: 16 }}>
        Payments
      </Text>

      <PaymentForm
        onSubmit={({ payee, amount }) => {
          addPayment(payee, -Math.abs(amount)); // make user-entered amounts outgoing by default
        }}
      />

      <View style={{ height: 16 }} />

      {payments.map(p => (
        <View key={p.id} style={{ marginBottom: 12 }}>
          <PaymentCard title={p.payee} subtitle={new Date(p.createdAt).toLocaleString()} amount={p.amount} />
        </View>
      ))}
    </ScrollView>
  );
}
