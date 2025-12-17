// src/navigation/screens.ts
import DashboardScreen from 'screens/DashboardScreen';
import SettingsScreen from 'screens/SettingsScreen';
import BudgetsScreen from 'screens/BudgetsScreen';

export const screens = {
  Home: {
    title: 'Home',
    component: DashboardScreen,
  },
  Budgets: {
    title: 'Budgets',
    component: BudgetsScreen,
  },
  Settings: {
    title: 'Settings',
    component: SettingsScreen,
  },
} as const;

export type ScreenKey = keyof typeof screens;
