import { View, Text, ScrollView, Button } from 'react-native';
import BalanceCard from '../components/BalanceCard';
import PaymentCard from '../components/PaymentCard';
import UpcomingTimeline from '../components/UpcomingTimeline';
import RecurringPayment from '../components/RecurringPayment';
import { useApp } from '../state/AppState';

export default function Dashboard({ navigation }) {
  const { balance, payments } = useApp();
  const lastPayment = payments[0];

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: '#0B0D13' }}>
      <Text style={{ color: 'white', fontSize: 24, fontWeight: '600', marginBottom: 16 }}>
        Dashboard
      </Text>

      <BalanceCard balance={balance} currency="£" />

      <View style={{ height: 12 }} />

      {lastPayment ? (
        <PaymentCard
          title="Last Payment"
          amount={lastPayment.amount}
          subtitle={lastPayment.payee}
        />
      ) : null}

      <View style={{ height: 12 }} />

      <UpcomingTimeline
        items={[
          { title: 'Rent', date: '2025-10-10', amount: -950 },
          { title: 'Salary', date: '2025-10-28', amount: 2100 },
        ]}
      />

      <View style={{ height: 12 }} />

      <RecurringPayment
        name="Gym Membership"
        amount={-29.99}
        schedule="Monthly"
        nextDate="2025-10-15"
      />

      <View style={{ height: 16 }} />
      <Button title="Go to Payments" onPress={() => navigation.navigate('Payments')} />
    </ScrollView>
  );
}
