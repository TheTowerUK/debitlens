// src/navigations/types.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Account: { accountId: string };
  Settings: undefined;
  ImportCSV: undefined;
  History: undefined;
  Reports?: undefined;
  Budgets?: undefined;
  Notifications?: undefined;
  Recurring?: undefined;
};
