// src/screens/ReportListScreen.tsx
import React from 'react';
import { View, FlatList, Pressable, Text, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { listReports, deleteReport, SavedReport } from '../services/reporting';

import { executor } from '../db/db'; // <- import the executor

function useDb(): { executor: any } {
  // simple hook wrapper that returns the imported executor instance
  return React.useMemo(() => ({ executor }), []);
}


