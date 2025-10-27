// src/state/AppProvider.tsx
import React from 'react';
import { useAppReady } from '../hooks/useAppReady';

type Props = { children: React.ReactNode };

export function AppProvider({ children }: Props) {
  const ready = useAppReady();

  if (!ready) return null; // Or replace with a loading spinner

  return <>{children}</>;
}

export default AppProvider;
