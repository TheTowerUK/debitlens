// src/navigations/types.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Account: { accountId: string };
  Settings: undefined;
  ImportCSV: undefined;

  // You can keep these for later if you want:
  History: undefined;
  Reports?: undefined;
  Budgets?: undefined;
  Notifications?: undefined;
  Recurring?: undefined;
};
