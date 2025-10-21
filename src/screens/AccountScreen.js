// src/screens/AccountScreen.js
import React from 'react';
import { View, Text, Pressable, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { deleteAccount, getAccount } from '../services/accounts';

export default function AccountScreen({ route, navigation }) {

  const accountId = route?.params?.accountId;

  // Guard missing id
if (!accountId) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', padding:16 }}>
      <Text>No account selected.</Text>
    </View>
  );
}

  const isUnassigned = accountId === 'unassigned';

const [loading, setLoading] = React.useState(true);
const [account, setAccount] = React.useState(null);
const [error, setError] = React.useState(null);

// Load details with try/catch
const load = React.useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const a = await getAccount(accountId);       // <-- your service call
    setAccount(a || null);
  } catch (e) {
    console.warn('Account load error', e);
    setError(String(e?.message || e));
  } finally {
    setLoading(false);
  }
}, [accountId]);

React.useEffect(() => { load(); }, [load]);

// Header (wrap in try, and only set if not unassigned)
React.useLayoutEffect(() => {
  try {
    navigation.setOptions({
      title: account?.name ? `Account: ${account.name}` : 'Account',
      headerRight: isUnassigned ? undefined : () => (
        <Pressable
          onPress={() => {
            Alert.alert(
              'Delete account',
              'This will reassign its transactions to “Unassigned”. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                      await deleteAccount(accountId); // <-- your service call
                      navigation.navigate('Dashboard');
                    } catch (e) {
                      Alert.alert('Delete failed', String(e?.message || e));
                    }
                  } 
                },
              ]
            );
          }}
          style={{ paddingVertical:6, paddingHorizontal:12, borderWidth:1, borderRadius:10, marginRight:8 }}
        >
          <Text>Delete</Text>
        </Pressable>
      ),
    });
  } catch (e) {
    console.warn('setOptions error', e);
  }
}, [navigation, accountId, isUnassigned, account?.name]);
}
