import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider } from './src/state/AppState';

import SplashAuthScreen from './src/screens/SplashAuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import AccountScreen from './src/screens/AccountScreen';
import ReportsScreen from './src/screens/ReportsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Dashboard">
        {/* Temporarily comment Splash while we verify */}
        {/* <Stack.Screen name="SplashAuth" component={SplashAuthScreen} /> */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Account" component={AccountScreen} />
        <Stack.Screen name="Reports" component={ReportsScreen} />
      </Stack.Navigator>

      </NavigationContainer>
    </AppProvider>
  );
}

