// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigations/RootNavigator';
import { AppProvider } from './src/state/AppContext';
import NotificationBootstrapper from './src/notifications/NotificationBootstrapper'; // 👈 new path

const App: React.FC = () => (
  <AppProvider>
    <NotificationBootstrapper />
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  </AppProvider>
);

export default App;
