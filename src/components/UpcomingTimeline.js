import { View, Text } from 'react-native';

export default function UpcomingTimeline({ items = [] }) {
  return (
    <View style={{
      backgroundColor: '#111827',
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: '#1F2937'
    }}>
      <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
        Upcoming
      </Text>
      {items.length === 0 ? (
        <Text style={{ color: '#9CA3AF' }}>Nothing scheduled.</Text>
      ) : items.map((it, idx) => (
        <View key={idx} style={{ paddingVertical: 8, borderTopWidth: idx ? 1 : 0, borderTopColor: '#1F2937' }}>
          <Text style={{ color: 'white', fontWeight: '600' }}>{it.title}</Text>
          <Text style={{ color: '#9CA3AF' }}>{it.date}</Text>
          <Text style={{ color: (it.amount < 0) ? '#F87171' : '#34D399', fontWeight: '700' }}>
            {(it.amount < 0 ? '-' : '+') + '£' + Math.abs(it.amount).toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}
