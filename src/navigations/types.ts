// src/navigations/types.ts
export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  //Accounts
  Account: { accountId: string };
  AddAccount: undefined;

  //Editor
  TxnEditor: { id?: string; accountId?: string; type?: 'income' | 'expense';    // used by Dashboard quick-add
  };

  //Dashboard Navigations
  Budgets?: undefined;
  Recurring?: undefined;
  Payments: undefined;  

  //Other Screens
  SplashAuth: undefined;
  Notifications?: undefined;
  Settings: undefined;
  ImportCSV: undefined;
  History: undefined;
  Reports?: undefined;
};
