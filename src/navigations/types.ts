export type RootStackParamList = {
  // Auth / Home
  Login: undefined;
  Dashboard: undefined;

  // Accounts
  Account: { accountId: string };
  AddAccount: undefined;     // only include if you actually register it

  // Editor
  TxnEditor: {
    id?: string;
    txId?: string;
    accountId?: string;
    type?: 'income' | 'expense';
  };

  // Dashboard-linked
  Payments: undefined;
  Recurring: undefined;
  RecurringEditor: { id?: string };
  Budgets: undefined;

  // Other
  Notifications: undefined;
  Settings: undefined;
  Reports: undefined;
  History: undefined;
  ImportCSV: undefined; 


  // Keep only if you register the screens:
  // ImportCSV: undefined;
  // History: undefined;
};
