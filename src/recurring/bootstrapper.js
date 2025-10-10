// src/recurring/bootstrapper.js
import { useEffect } from 'react';
import { useApp } from '../state/AppState';

export default function RecurringBootstrapper() {
  const { state, actions } = useApp();
  useEffect(() => {
    if (!state?.isHydrated) return;
    actions.runRecurringGeneration();
  }, [state?.isHydrated]);
  return null;
}
