// src/screens/ReportEditorScreen.js
import React from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { saveReport } from '../services/reporting';

function genId() {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ReportEditorScreen({ navigation }) {
  const [name, setName] = React.useState('Last 90 days — Spend over time');
  const [type, setType] = React.useState('spend_over_time'); // or 'by_category'
  const today = new Date().toISOString().slice(0, 10);
  const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = React.useState(ninetyAgo);
  const [dateTo, setDateTo] = React.useState(today);

const save = async () => {
  try {
    if (!name.trim()) return Alert.alert('Name required');
    const r = {
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,
      name,
      type,
      params: { dateFrom, dateTo, accountIds: [], categoryIds: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveReport(r);
    Alert.alert('Saved', 'Report created');
    navigation.goBack(); // 👈 ensures Reports regains focus and reloads
  } catch (e) {
    Alert.alert('Save failed', String(e?.message || e));
  }
};

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>Create Report</Text>

      <Text style={{ fontWeight: '600' }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Report name"
        style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
      />

      <Text style={{ fontWeight: '600', marginTop: 8 }}>Type</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => setType('spend_over_time')}
          style={{ padding: 10, borderWidth: 1, borderRadius: 10, backgroundColor: type === 'spend_over_time' ? '#E5E7EB' : 'transparent' }}
        >
          <Text>Spend over time</Text>
        </Pressable>
        <Pressable
          onPress={() => setType('by_category')}
          style={{ padding: 10, borderWidth: 1, borderRadius: 10, backgroundColor: type === 'by_category' ? '#E5E7EB' : 'transparent' }}
        >
          <Text>By category</Text>
        </Pressable>
      </View>

      <Text style={{ fontWeight: '600', marginTop: 8 }}>Date From (YYYY-MM-DD)</Text>
      <TextInput value={dateFrom} onChangeText={setDateFrom} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />

      <Text style={{ fontWeight: '600', marginTop: 8 }}>Date To (YYYY-MM-DD)</Text>
      <TextInput value={dateTo} onChangeText={setDateTo} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />

      <Pressable onPress={save} style={{ marginTop: 16, padding: 12, borderWidth: 1, borderRadius: 10, alignItems: 'center' }}>
        <Text>Save</Text>
      </Pressable>
    </View>
  );
}
