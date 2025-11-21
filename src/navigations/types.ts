export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Payments: undefined;
  Recurring: undefined;
  Notifications: undefined;
  Budgets: undefined;
  Settings: undefined;
  ImportCSV: undefined;

  Account:
    | {
        accountId?: string;
      }
    | undefined;

  AddAccount: undefined;

  History: undefined;
  Reports: undefined;

  RecurringEditor:
    | {
        id?: string;
      }
    | undefined;

  TxnEditor:
    | {
        id?: string;
        accountId?: string;
        type?: 'income' | 'expense';
      }
    | undefined;

  Transfer:
    | {
        fromAccountId?: string;
      }
    | undefined;

  // 🔹 NEW
  RecentActivity: undefined;
};
