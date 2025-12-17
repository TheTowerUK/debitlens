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
        placeholderTextColor="#7a7a7a"
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
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#0b0b0b',
    flexGrow: 1,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 16,
    color: '#fff',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    color: 'rgba(255,255,255,0.85)',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    color: '#fff',
  },
  buttonRow: {
    marginTop: 8,
  },
  btnPrimary: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontWeight: '800',
    color: '#fff',
  },
  btnSecondary: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
});

