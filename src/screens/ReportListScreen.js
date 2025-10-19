import React from 'react';
import { View, FlatList, Pressable, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listReports } from '../services/reporting';

export default function ReportListScreen({ navigation }) {
  const [items, setItems] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    try { setItems(await listReports()); }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        const r = await listReports();
        if (mounted) setItems(r);
      })();
      return () => { mounted = false; };
    }, [])
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        refreshing={refreshing}
        onRefresh={load}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListEmptyComponent={<Text>No reports yet</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
            style={{ padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 }}
          >
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text>{item.type}</Text>
            <Text style={{ color: '#6B7280', marginTop: 4 }}>
              Updated {new Date(item.updatedAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
