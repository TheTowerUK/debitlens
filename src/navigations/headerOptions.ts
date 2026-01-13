// src/navigations/headerOptions.ts
import { colors } from '../theme/colors';

export const brandHeaderOptions = {
  headerStyle: {
    backgroundColor: colors.bg,
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  headerBackTitleVisible: false,
};

