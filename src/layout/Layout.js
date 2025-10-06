import { SafeAreaView, StatusBar } from 'react-native';

export default function Layout({ children }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0D13' }}>
      <StatusBar barStyle="light-content" />
      {children}
    </SafeAreaView>
  );
}
