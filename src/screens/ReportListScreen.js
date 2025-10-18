// src/screens/ReportListScreen.js
import React from 'react';
import { View, FlatList, Pressable, Text } from 'react-native';
import { useFocusEffect, useLayoutEffect } from '@react-navigation/native';
import { listReports } from '../services/reporting';

export default function ReportListScreen({ navigation }) {
  const [items, setItems] = React.useState([]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ReportEditor')}
          style={{ paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginRight: 8 }}
        >
          <Text>New</Text>
        </Pressable>
      ),
      title: 'Reports',
    });
  }, [navigation]);

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      listReports().then(r => mounted && setItems(r));
      return () => { mounted = false; };
    }, [])
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={<Text>No reports yet</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
            style={{ padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12 }}
          >
            <Text style={{ fontWeight: '600' }}>{item.name}</Text>
            <Text>{item.type}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
