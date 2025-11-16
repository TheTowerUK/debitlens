export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Payments: undefined;
  Recurring: undefined;
  Notifications: undefined;
  Budgets: undefined;
  Settings: undefined;
  ImportCSV: undefined;
  Account: undefined;
  History: undefined;
  Reports: undefined;
  TxnEditor: { id?: string } | undefined;

  // 🔽 ADD THIS
  RecurringEditor: { id?: string } | undefined;
};

