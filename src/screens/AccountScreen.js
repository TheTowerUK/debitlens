// src/screens/AccountScreen.js
import React from 'react';
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { deleteAccount, getAccount } from '../services/accounts';

export default function AccountScreen({ route, navigation }) {
    // at the top of AccountScreen component:
  const accountId = route?.params?.accountId;
  if (!accountId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text>No account selected.</Text>
      </View>
    );
  }
  
  const isUnassigned = accountId === 'unassigned';

  const [loading, setLoading] = React.useState(true);
  const [account, setAccount] = React.useState(null);
  const [error, setError] = React.useState(null);

  // Load account details
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const a = await getAccount(accountId);
      setAccount(a || null);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  React.useEffect(() => {
    if (!accountId) {
      setError('No accountId provided');
      setLoading(false);
      return;
    }
    load();
  }, [accountId, load]);

  // Header: Delete (hidden for Unassigned)
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: account?.name ? `Account: ${account.name}` : 'Account',
      headerRight: isUnassigned
        ? undefined
        : () => (
            <Pressable
              onPress={() => {
                Alert.alert(
                  'Delete account',
                  'This will reassign its transactions to “Unassigned”. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteAccount(accountId);
                          navigation.navigate('Dashboard'); // or navigation.goBack()
                        } catch (e) {
                          Alert.alert('Delete failed', String(e?.message || e));
                        }
                      },
                    },
                  ]
                );
              }}
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
  }, [navigation, accountId, isUnassigned, account?.name]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ color: '#DC2626', marginBottom: 8 }}>{error}</Text>
        <Pressable onPress={load} style={{ padding: 10, borderWidth: 1, borderRadius: 10 }}>
          <Text>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!account) {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Account not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ padding: 12, borderWidth: 1, borderRadius: 12 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Details</Text>
        <Row label="ID" value={account.id} />
        <Row label="Name" value={account.name} />
        {'archived' in account ? <Row label="Archived" value={account.archived ? 'Yes' : 'No'} /> : null}
      </View>

      {/* Add more sections here (balances, recent transactions, etc.) */}
    </ScrollView>
  );
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#6B7280' }}>{label}</Text>
      <Text>{String(value ?? '')}</Text>
    </View>
  );
}
