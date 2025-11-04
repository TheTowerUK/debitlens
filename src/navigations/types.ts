// src/navigations/types.ts
export type RootStackParamList = {
  Login: undefined;
  Settings: undefined;
  Dashboard: undefined;
  Account: { accountId: string };
  History?: undefined;
  Reports?: undefined;
  Budgets?: undefined;
  Notifications?: undefined;
  Recurring?: undefined;
  ImportCSV?: undefined;
};
