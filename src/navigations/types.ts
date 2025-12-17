export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Payments: undefined;
  Recurring: undefined;
  Notifications: undefined;
  Budgets: undefined;
  Settings: undefined;
  ImportCSV: undefined;
  Account: { accountId: string };
  DataExportImport: undefined;
  AddAccount: undefined;
  History: undefined;
  Reports: undefined;

  ReportDetail: {
    categoryKey: string;
    period: 'thisMonth' | 'lastMonth' | 'allTime';
  };

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
  Data: undefined;
};
