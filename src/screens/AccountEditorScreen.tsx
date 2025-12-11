// src/screens/AccountEditorScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useApp, Account } from '../state/AppContext';

type Props = {
  navigation: any;
  route: {
    params?: {
      accountId?: string;
    };
  };
};

const AccountEditorScreen: React.FC<Props> = ({ navigation, route }) => {
  const { state, actions } = useApp();
  const accountId = route.params?.accountId;

  const account: Account | undefined = useMemo(
    () => state.accounts.find((a) => a.id === accountId),
    [state.accounts, accountId]
  );

  const [name, setName] = useState<string>(account?.name ?? '');

  const handleSave = () => {
    if (!accountId) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    actions.updateAccount(accountId, {
      name: trimmedName,
    });

    navigation.goBack();
  };

  const handleDelete = () => {
    if (!accountId) {
      return;
    }
    actions.deleteAccount(accountId);
    navigation.goBack();
  };

  if (!accountId || !account) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Account not found</Text>
        <View style={styles.buttonRow}>
          <Button title="Back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Edit Account</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Main Current Account"
      />

      <View style={styles.buttonRow}>
        <Button title="Save changes" onPress={handleSave} />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Delete account" color="red" onPress={handleDelete} />
      </View>
    </ScrollView>
  );
};

export default AccountEditorScreen;

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
