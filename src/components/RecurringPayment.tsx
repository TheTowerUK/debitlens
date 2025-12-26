import { View, Text } from 'react-native';

export default function RecurringPayment({ name, amount, schedule, nextDate }) {
  return (
    <View style={{
      backgroundColor: theme.cardAlt,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border
    }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{name}</Text>
      <Text style={{ color: theme.textDim, marginTop: 4 }}>{schedule} • Next {nextDate}</Text>
      <Text style={{
        color: amount < 0 ? '#F87171' : '#34D399',
        fontSize: 18, fontWeight: '700', marginTop: 8
      }}>
        {amount < 0 ? '-' : '+'}£{Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  );
}
