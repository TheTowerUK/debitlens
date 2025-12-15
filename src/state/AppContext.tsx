import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

/* =====================
   Types
===================== */

export type Account = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'other';
  balance: number; // opening balance
  archived?: boolean;
};

export type TransactionType = 'income' | 'expense' | 'transfer';

export type Transaction = {
  id: string;
  name?: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  category?: string;
  amount: number;
  description?: string;
};

/* ===== Recurring (match existing screens) ===== */

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringItem = {
  id: string;

  // Your screens use title (not name)
  title: string;

  // Some screens expect active
  active: boolean;

  // Your screens use nextDueDate (not nextDate)
  nextDueDate: string; // YYYY-MM-DD

  // Frequency
  frequency: RecurringFrequency;

  // Amount/type
  amount: number;
  type: 'income' | 'expense';

  // Optional details
  category?: string;
  description?: string;

  // Non-transfer recurring uses accountId
  accountId?: string;

  // Some screens expect transfer flags/fields
  isTransfer?: boolean;
  fromAccountId?: string;
  toAccountId?: string;
};

export type AppState = {
  accounts: Account[];
  transactions: Transaction[];
  recurring: RecurringItem[];
};

export type AppActions = {
  /* Accounts */
  addAccount: (input: Omit<Account, 'id'>) => Account;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  deleteAccount: (id: string) => void;

  /* Transactions */
  addTransaction: (input: Omit<Transaction, 'id'>) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  /* Recurring */
  addRecurring: (input: Omit<RecurringItem, 'id'>) => RecurringItem;
  updateRecurring: (id: string, patch: Partial<RecurringItem>) => void;
  deleteRecurring: (id: string) => void;

  /* Full restore (Option 1) */
  replaceAllData: (next: {
    accounts: Account[];
    transactions: Transaction[];
    recurring?: RecurringItem[];
  }) => void;
};

type AppContextValue = {
  state: AppState;
  actions: AppActions;

  // ✅ SplashAuthScreen expects these at top-level
  getPin: () => string | null;
  setPin: (pin: string | null) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function uuid() {
  // crypto.randomUUID isn't always available in RN
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [pin, setPinState] = useState<string | null>(null);

  const actions = useMemo<AppActions>(
    () => ({
      /* Accounts */
      addAccount: (input) => {
        const account: Account = { ...input, id: uuid() };
        setAccounts((prev) => [...prev, account]);
        return account;
      },
      updateAccount: (id, patch) => {
        setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      },
      deleteAccount: (id) => {
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setTransactions((prev) => prev.filter((t) => t.accountId !== id));
        // remove recurring referencing account
        setRecurring((prev) =>
          prev.filter((r) => r.accountId !== id && r.fromAccountId !== id && r.toAccountId !== id)
        );
      },

      /* Transactions */
      addTransaction: (input) => {
        const txn: Transaction = { ...input, id: uuid() };
        setTransactions((prev) => [...prev, txn]);
        return txn;
      },
      updateTransaction: (id, patch) => {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      },
      deleteTransaction: (id) => {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      },

      /* Recurring */
      addRecurring: (input) => {
        const item: RecurringItem = { ...input, id: uuid() };
        setRecurring((prev) => [...prev, item]);
        return item;
      },
      updateRecurring: (id, patch) => {
        setRecurring((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      },
      deleteRecurring: (id) => {
        setRecurring((prev) => prev.filter((r) => r.id !== id));
      },

      /* Full restore */
      replaceAllData: (next) => {
        setAccounts(next.accounts || []);
        setTransactions(next.transactions || []);
        setRecurring(next.recurring || []);
      },
    }),
    []
  );

  const state = useMemo<AppState>(
    () => ({ accounts, transactions, recurring }),
    [accounts, transactions, recurring]
  );

  const getPin = () => pin;
  const setPin = (nextPin: string | null) => setPinState(nextPin);

  return (
    <AppContext.Provider value={{ state, actions, getPin, setPin }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
