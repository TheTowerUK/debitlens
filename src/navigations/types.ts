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
  Payments: undefined;  
  SplashAuth: undefined;
  TxnTxnEditor: { id?: string; accountId?: string; type?: 'income' | 'expense' };
  TxnEditor?: { txId?: string; accountId?: string };
};
