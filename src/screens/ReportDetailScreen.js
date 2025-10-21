// src/screens/ReportDetailScreen.js
import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import LineChart from '../components/LineChart';
import { toCSV } from '../utils/csv';
import {
  getReport as fetchReport,           // <- alias to avoid any accidental name clash
  getSpendOverTime,
  getByCategory,
  deleteReport,
} from '../services/reporting';

export default function ReportDetailScreen({ route, navigation }) {
  const { id } = route?.params?.id;

  if (!id) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
        <Text>No report id provided.</Text>
      </View>
    );
  }

  const [title, setTitle] = React.useState('Report');
  const [type, setType] = React.useState('spend_over_time');
  const [dataset, setDataset] = React.useState([]);

 
  // Load report + dataset
  React.useEffect(() => {
    (async () => {
      const r = await fetchReport(id);
      if (!r) return;
      setTitle(r.name);
      setType(r.type);
      if (r.type === 'spend_over_time') {
        const data = await getSpendOverTime(r.params);
        setDataset(data);
      } else {
        const data = await getByCategory(r.params);
        setDataset(data);
      }
    })();
  }, [id]);

  // Header delete button
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Report',
      headerRight: () => (
        <Pressable
          onPress={() =>
            Alert.alert('Delete report', `Delete “${title}”?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteReport(id);
                  navigation.goBack();
                },
              },
            ])
          }
          style={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderWidth: 1,
            borderRadius: 10,
            marginRight: 8,
          }}
        >
          <Text>Delete</Text>
        </Pressable>
      ),
    });
  }, [navigation, id, title]);

  // CSV export
  const exportCSV = async () => {
    try {
      const csv = toCSV(dataset);
      const path = FileSystem.cacheDirectory + `report_${id}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Share CSV' });
      } else {
        Alert.alert('Saved CSV to', path);
      }
    } catch (e) {
      Alert.alert('Export failed', String(e?.message || e));
    }
  };

  const isTimeSeries = type === 'spend_over_time';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>{title}</Text>

      {isTimeSeries ? (
        <LineChart data={dataset} />
      ) : (
        <View style={{ borderWidth: 1, borderRadius: 12, padding: 12 }}>
          {dataset.map((d, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
              <Text>{d.categoryId || 'Uncategorised'}</Text>
              <Text>£{Number(d.spend || 0).toFixed(2)}</Text>
            </View>
          ))}
          {!dataset.length && <Text>No data</Text>}
        </View>
      )}

      <Pressable
        onPress={exportCSV}
        style={{ marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center' }}
      >
        <Text>Export CSV</Text>
      </Pressable>

      {/* Debug view */}
      <View style={{ marginTop: 16 }}>
        {dataset.map((d, i) => (
          <Text key={i}>{JSON.stringify(d)}</Text>
        ))}
      </View>
    </ScrollView>
  );
}
