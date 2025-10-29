// src/components/AccountForm.js
import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';

export default function AccountForm({ name, type, setName, setType, onSave, onCancel }) {
  return (
    <View>
      <Text style={{ color: '#9CA3AF', marginBottom: 6 }}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Main, Savings, Credit Card"
        style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 }}
      />

      <Text style={{ color: '#9CA3AF', marginBottom: 6 }}>Type (optional)</Text>
      <TextInput
        value={type}
        onChangeText={setType}
        placeholder="e.g. bank, card, cash"
        style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable
          style={{ backgroundColor: '#374151', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}
          onPress={onCancel}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <Pressable
          style={{ backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 }}
          onPress={onSave}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
