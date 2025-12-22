// src/screens/AddAccountScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useApp } from '../state/AppContext';

type Props = {
  navigation: any; // you can tighten this later with your stack types
};

const AddAccountScreen: React.FC<Props> = ({ navigation }) => {
  const { actions } = useApp();

  const [name, setName] = useState<string>('');

  const handleSave = () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      // You could use Alert here if you like
      return;
    }

    // We only pass the fields that actually exist on Account.
  actions.addAccount({
    name: trimmedName,
    type: 'bank',   // sensible default
    balance: 0,     // opening balance
  });


    navigation.goBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Add Account</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Main Current Account"
        placeholderTextColor="#6B7280"
      />

      <View style={styles.buttonRow}>
        <Pressable style={styles.btnPrimary} onPress={handleSave}>
          <Text style={styles.btnPrimaryText}>Save account</Text>
        </Pressable>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={styles.btnSecondary} onPress={() => navigation.goBack()}>
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default AddAccountScreen;

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 35,
    paddingBottom: 32,
    backgroundColor: '#0B1020',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    color: '#E5E7EB',
  },
  input: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: '#E5E7EB',
    backgroundColor: '#111827',
  },
  buttonRow: {
    marginTop: 10,
  },
  btnPrimary: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#E5E7EB',
    fontWeight: '800',
  },
  btnSecondary: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
    backgroundColor: '#0B1020',
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#E5E7EB',
    fontWeight: '800',
  },
});


