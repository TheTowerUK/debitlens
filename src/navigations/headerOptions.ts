// src/navigations/headerOptions.ts
import React from 'react';
import { colors } from '../theme/colors';
import HeaderBackButton from '../components/HeaderBackButton';

export const brandHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.bg,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  headerBackTitleVisible: false,
  headerBackVisible: false, // Hide default back button on left
  headerRight: () => <HeaderBackButton />, // Back button on right
};

