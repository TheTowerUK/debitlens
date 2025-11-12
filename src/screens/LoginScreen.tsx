// src/screens/LoginScreen.tsx
import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigations/types';
import SplashAuthScreen from './SplashAuthScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen(props: Props) {
  return <SplashAuthScreen {...props} />;
}
