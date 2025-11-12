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
  Budget: undefined;
  TxnEditor: {
    id?: string;                    // used by TxnEditorScreen as params.id
    accountId?: string;
    type?: 'income' | 'expense';    // used by Dashboard quick-add
  };
};
