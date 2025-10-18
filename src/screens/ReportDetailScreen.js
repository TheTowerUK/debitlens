// src/screens/ReportDetailScreen.js
import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { getReport, getSpendOverTime, getByCategory } from '../services/reporting';
import { toCSV } from '../utils/csv';

export default function ReportDetailScreen({ route }) {
  const { id } = route.params;
  const [title, setTitle] = React.useState('Report');
  const [dataset, setDataset] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      const r = await getReport(id);
      if (!r) return;
      setTitle(r.name);
      if (r.type === 'spend_over_time') {
        const data = await getSpendOverTime(r.params);
        setDataset(data);
      } else {
        const data = await getByCategory(r.params);
        setDataset(data);
      }
    })();
  }, [id]);

  const exportCSV = () => {
    try {
      const csv = toCSV(dataset);
      Alert.alert('CSV (preview)', csv.slice(0, 200) + (csv.length > 200 ? '…' : ''));
    } catch (e) {
      Alert.alert('Export failed', String(e?.message || e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{title}</Text>

      {/* Chart placeholder (will add svg later) */}
      <View style={{ height: 200, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Chart coming next</Text>
      </View>

      <Pressable onPress={exportCSV} style={{ marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1 }}>
        <Text>Export CSV</Text>
      </Pressable>

      <View style={{ marginTop: 16 }}>
        {dataset.map((d, i) => <Text key={i}>{JSON.stringify(d)}</Text>)}
      </View>
    </ScrollView>
  );
}
