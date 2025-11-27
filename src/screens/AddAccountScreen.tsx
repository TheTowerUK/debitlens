// src/screens/AddAccountScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useApp } from '../state/AppContext';

type Props = {
  navigation: any; // you can tighten this later with your stack types
};

const AddAccountScreen: React.FC<Props> = ({ navigation }) => {
  const { actions } = useApp();

  const [name, setName] = useState<string>('');
  const [label, setLabel] = useState<string>('');

  const handleSave = () => {
    const trimmedName = name.trim();
    const trimmedLabel = label.trim();

    if (!trimmedName) {
      // you could use Alert here if you like
      return;
    }

    actions.addAccount({
      name: trimmedName,
      label: trimmedLabel || trimmedName,
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
      />

      <Text style={styles.label}>Label (optional)</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="Short label to show in lists"
      />

      <View style={styles.buttonRow}>
        <Button title="Save account" onPress={handleSave} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Cancel" onPress={() => navigation.goBack()} />
      </View>
    </ScrollView>
  );
};

export default AddAccountScreen;

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  buttonRow: {
    marginTop: 8,
    marginBottom: 8,
  },
});
