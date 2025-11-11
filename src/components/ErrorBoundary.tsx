// src/components/ErrorBoundary.tsx
import React from 'react';
import { View, Text } from 'react-native';

type Props = {
  children?: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // log error somewhere
    console.log('ErrorBoundary caught', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View>
          <Text style={{ fontSize: 18, fontWeight: '600' }}>Something went wrong</Text>
        </View>
      );
    }
    return this.props.children ?? null;
  }
  }

