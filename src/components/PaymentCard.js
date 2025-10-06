import { View, Text } from 'react-native';

export default function PaymentCard({ title, subtitle, amount }) {
  const isNegative = amount < 0;
  return (
    <View style={{
      backgroundColor: '#111827',
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: '#1F2937'
    }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>{title}</Text>
      {subtitle ? <Text style={{ color: '#9CA3AF', marginTop: 4 }}>{subtitle}</Text> : null}
      <Text style={{
        color: isNegative ? '#F87171' : '#34D399',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8
      }}>
        {isNegative ? '-' : '+'}£{Math.abs(amount).toFixed(2)}
      </Text>
    </View>
  );
}
