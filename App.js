import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Layout from './src/layout/Layout';
import Dashboard from './src/screens/Dashboard';
import Payments from './src/screens/Payments';
import { AppProvider } from './src/state/AppState';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Layout>
          <Stack.Navigator>
            <Stack.Screen name="Dashboard" component={Dashboard} />
            <Stack.Screen name="Payments" component={Payments} />
          </Stack.Navigator>
        </Layout>
      </NavigationContainer>
    </AppProvider>
  );
}
