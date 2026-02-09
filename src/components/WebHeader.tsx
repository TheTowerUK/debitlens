// src/components/WebHeader.tsx
// Web-only HTML/CSS header; RN header is hidden on web via screenOptions.

import React from 'react';
import { Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';

const ROUTE_TITLES: Record<string, string> = {
  Dashboard: 'Dashboard',
  Account: 'Account',
  AddAccount: 'Add Account',
  Transfer: 'Transfer',
  RecentActivity: 'Recent Activity',
  History: 'History',
  TxnEditor: 'Transaction',
  Payments: 'Payments',
  Recurring: 'Recurring',
  Budgets: 'Budgets',
  BudgetEditor: 'Budget',
  Notifications: 'Notifications',
  RecurringEditor: 'Recurring Item',
  Settings: 'Settings',
  Reports: 'Reports',
  Help: 'Help & Guide',
  About: 'About',
  PrivacyPolicy: 'Privacy Policy',
  DataExportImport: 'Import / Export',
  ImportCSV: 'Import CSV',
  ReportDetail: 'Report Details',
};

export default function WebHeader() {
  if (Platform.OS !== 'web') return null;

  const navigation = useNavigation<any>();
  const route = useRoute();
  const routeName = route?.name ?? '';
  const title = ROUTE_TITLES[routeName] ?? routeName;
  const canGoBack = typeof navigation?.canGoBack === 'function' ? navigation.canGoBack() : false;

  // Login has no header
  if (routeName === 'Login') return null;

  const handleBack = () => {
    if (navigation?.goBack) navigation.goBack();
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: colors.bg,
    color: colors.text,
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
  };

  return (
    <header style={headerStyle}>
      <div className="header-inner">
        <div className="brand">
          <h1 className="title">{title}</h1>
        </div>
        <nav>
          {canGoBack && (
            <button
              type="button"
              onClick={handleBack}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.link,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 700,
                padding: '6px 12px',
              }}
            >
              Back
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
