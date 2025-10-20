// App.js — isolation build
import 'react-native-gesture-handler';
import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// 👉 Mock provider (bypass your AppProvider just for isolation)
function MockProvider({ children }) {
  return <>{children}</>;
}

const Stack = createNativeStackNavigator();

// Safe test entry
function HomeTest({ navigation }) {
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
      <Text style={{ fontSize: 18, marginBottom: 16 }}>Isolation Start</Text>
      <Text
        onPress={() => navigation.navigate('SplashAuth')}
        style={{ textDecorationLine: 'underline' }}
      >
        Go to SplashAuth
      </Text>
    </View>
  );
}

// Minimal error boundary so JS errors show instead of native crash
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.warn('UI error caught', err, info?.componentStack); }
  render() {
    if (this.state.error) {
      return (
        <View style={{flex:1, alignItems:'center', justifyContent:'center', padding:16}}>
          <Text style={{fontWeight:'700', marginBottom:8}}>Something went wrong</Text>
          <Text style={{color:'#DC2626'}}>{String(this.state.error?.message || this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <MockProvider>
      <NavigationContainer>
        <ErrorBoundary>
          <Stack.Navigator
            initialRouteName="HomeTest"
            screenOptions={{ headerStyle: { backgroundColor: '#0B0D13' }, headerTintColor: '#fff' }}
          >
            <Stack.Screen name="HomeTest" component={HomeTest} options={{ title: 'Test' }} />

            {/* Lazily load EACH screen so a bad import won't crash startup */}
            <Stack.Screen name="SplashAuth" options={{ headerShown: false }}
              getComponent={() => require('./src/screens/SplashAuthScreen').default} />
            <Stack.Screen name="Login" options={{ headerShown: false }}
              getComponent={() => require('./src/screens/LoginScreen').default} />
            <Stack.Screen name="Dashboard" options={{ title: 'Dashboard' }}
              getComponent={() => require('./src/screens/DashboardScreen').default} />
            <Stack.Screen name="Account" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/AccountScreen').default} />
            <Stack.Screen name="TxnEditor" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/TxnEditorScreen').default} />
            <Stack.Screen name="History" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/HistoryScreen').default} />
            <Stack.Screen name="Budgets" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/BudgetsScreen').default} />
            <Stack.Screen name="Recurring" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/RecurringScreen').default} />
            <Stack.Screen name="Settings" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/SettingsScreen').default} />
            <Stack.Screen name="Notifications" options={{ headerBackTitleVisible: false }}
              getComponent={() => require('./src/screens/NotificationsScreen').default} />
            <Stack.Screen name="ImportCSV" options={{ title: 'Import CSV' }}
              getComponent={() => require('./src/screens/ImportCsvScreen').default} />
            <Stack.Screen name="Reports"
              getComponent={() => require('./src/screens/ReportListScreen').default} />
            <Stack.Screen name="ReportDetail"
              getComponent={() => require('./src/screens/ReportDetailScreen').default} />
            <Stack.Screen name="ReportEditor"
              getComponent={() => require('./src/screens/ReportEditorScreen').default} />
          </Stack.Navigator>
        </ErrorBoundary>
      </NavigationContainer>
    </MockProvider>
  );
}
