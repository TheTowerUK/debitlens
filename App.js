import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AppProvider from './src/state/AppState';
import { runMigrationsSafe as runMigrations } from './src/db/migrate';
import { getDb } from './src/db/db';

import SplashAuthScreen from './src/screens/SplashAuthScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
//import AccountScreen from './src/screens/AccountScreen';
import TxnEditorScreen from './src/screens/TxnEditorScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import BudgetsScreen from './src/screens/BudgetsScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ImportCsvScreen from './src/screens/ImportCsvScreen';
import ReportListScreen from './src/screens/ReportListScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import ReportEditorScreen from './src/screens/ReportEditorScreen';


const Stack = createNativeStackNavigator();
//const withBack = { headerBackTitle: '' };

export default function App() {
  const [ready, setReady] = React.useState(false);



  if (!ready) {
    return (
      <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppProvider>
      <NotificationBootstrapper />
      <RecurringBootstrapper />
      <ErrorBoundary>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="SplashAuth"
            screenOptions={{ headerStyle:{ backgroundColor:'#0B0D13' }, headerTintColor:'#fff' }}
          >
            <Stack.Screen name="SplashAuth" component={SplashAuthScreen} options={{ headerShown:false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown:false }} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title:'Dashboard' }} />
            
            
          </Stack.Navigator>
        </NavigationContainer>
      </ErrorBoundary>
    </AppProvider>
  );
}
