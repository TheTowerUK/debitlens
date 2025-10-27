// src/navigation/screens.ts
import HomeScreen from 'screens/HomeScreen';
import SettingsScreen from 'screens/SettingsScreen';

export const screens = {
  Home: {
    title: 'Home',
    component: HomeScreen,
  },
  Settings: {
    title: 'Settings',
    component: SettingsScreen,
  },
} as const;

export type ScreenKey = keyof typeof screens;
