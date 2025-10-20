import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';

import DashboardScreen from './src/screens/DashboardScreen';
import ReportListScreen from './src/screens/ReportListScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import ReportEditorScreen from './src/screens/ReportEditorScreen';
import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
//import AccountScreen from './src/screens/AccountScreen';
//import TxnEditorScreen from './src/screens/TxnEditorScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';


const Stack = createNativeStackNavigator();

function Home({ navigation }) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 16 }}>Isolation Start</Text>
      <Text onPress={() => navigation.navigate('Second')} style={{ textDecorationLine: 'underline', marginBottom: 12 }}>
        Go to Second
      </Text>
      <Text onPress={() => navigation.navigate('Dashboard')} style={{ textDecorationLine: 'underline' }}>
        Go to Dashboard
      </Text>
    </View>
  );
}
function Second() { return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Second</Text></View>; }

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Second" component={Second} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title:'Dashboard' }} />        
        <Stack.Screen name="Reports" component={ReportListScreen} />
        <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
        <Stack.Screen name="ReportEditor" component={ReportEditorScreen} />
        <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown:false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown:false }} />
        <Stack.Screen name="Account" component={AccountScreen} options={withBack} />
        <Stack.Screen name="History" component={HistoryScreen} options={withBack} />
        <Stack.Screen name="Budgets" component={BudgetsScreen} options={withBack} />
        <Stack.Screen name="Recurring" component={RecurringScreen} options={withBack} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={withBack} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={withBack} />
        <Stack.Screen name="ImportCSV" component={ImportCsvScreen} options={{ title:'Import CSV' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
