// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigations/RootNavigator';
import { AppProvider } from './src/state/AppContext';  // 👈 must be this file

const App: React.FC = () => {
  return (
    <AppProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppProvider>
  );
};

export default App;
