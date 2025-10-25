import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { getAccount, deleteAccount } from '../services/accounts';

export default function AccountScreen({ route, navigation }) {
  const accountId = route?.params?.accountId;
  const [account, setAccount] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: account?.name ? `Account: ${account.name}` : 'Account',
      headerRight: accountId && accountId !== 'unassigned' ? () => (
        <Pressable
          onPress={() => {
            Alert.alert('Delete account', 'Transactions will be moved to “Unassigned”. Continue?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                    await deleteAccount(accountId);
                    navigation.goBack();
                  } catch (e) { Alert.alert('Error', String(e?.message || e)); }
                } }
            ]);
          }}
          style={{ paddingVertical:6, paddingHorizontal:12, borderWidth:1, borderRadius:10, marginRight:8 }}
        >
          <Text>Delete</Text>
        </Pressable>
      ) : undefined,
    });
  }, [navigation, accountId, account?.name]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (!accountId) { setLoading(false); return; }
      try {
        const a = await getAccount(accountId);
        if (mounted) setAccount(a);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [accountId]);

  if (!accountId) {
    return <Center><Text>No account selected.</Text></Center>;
  }
  if (loading) {
    return <Center><Text>Loading…</Text></Center>;
  }
  if (!account) {
    return <Center><Text>Account not found.</Text></Center>;
  }

  return (
    <View style={{ flex:1, padding:16 }}>
      <Text style={{ fontSize:18, fontWeight:'700', marginBottom:8 }}>{account.name}</Text>
      <Text style={{ color:'#9CA3AF' }}>Type: {account.type || '—'}</Text>
      <Text style={{ color:'#9CA3AF' }}>ID: {account.id}</Text>
    </View>
  );
}

function Center({ children }) {
  return <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>{children}</View>;
}
