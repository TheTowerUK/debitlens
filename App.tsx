import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { AppProvider } from './src/state/AppContext';
import RootNavigator from './src/navigations/RootNavigator';

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
