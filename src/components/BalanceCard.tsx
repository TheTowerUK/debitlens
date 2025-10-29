import { View, Text } from 'react-native';

export default function BalanceCard({ balance = 0, currency = '£' }) {
  return (
    <View style={{
      backgroundColor: '#111827',
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: '#1F2937'
    }}>
      <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Available Balance</Text>
      <Text style={{ color: 'white', fontSize: 32, fontWeight: '700', marginTop: 4 }}>
        {currency}{Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}
