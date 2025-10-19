// src/screens/ReportListScreen.js
import React from 'react';
import { View, FlatList, Pressable, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listReports } from '../services/reporting';
import { Alert } from 'react-native';
import { listReports, deleteReport } from '../services/reporting';

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

  const Empty = () => (
    <View style={{ padding: 16 }}>
      <Text style={{ marginBottom: 12 }}>No reports yet</Text>
      <Pressable
        onPress={() => navigation.navigate('ReportEditor')}
        style={{ paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderRadius: 10, alignSelf: 'flex-start' }}
      >
        <Text>Create first report</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        refreshing={refreshing}
        onRefresh={load}
        // extra space for FAB:
        contentContainerStyle={{ padding: 16, paddingBottom: 80 /* extra space for FAB */ }}
        ListEmptyComponent={<Empty />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
            onLongPress={() => {
              Alert.alert(
                'Delete report',
                `Delete “${item.name}”?`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => {
                      await deleteReport(item.id);
                      const r = await listReports();
                      setItems(r);
                    } 
                  },
                ]
              );
            }}
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

      {/* Floating NEW button (always visible) */}
      <Pressable
        onPress={() => navigation.navigate('ReportEditor')}
        style={{
          position: 'absolute', right: 16, bottom: 16,
          paddingVertical: 12, paddingHorizontal: 16,
          borderRadius: 9999, borderWidth: 1,
          backgroundColor: '#111',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>+ New</Text>
      </Pressable>
    </View>
  );
}
