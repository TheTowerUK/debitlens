import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import TestReact from './src/TestReact';

const DummyProvider = ({ children }) => <>{children}</>;

export default function App() {
  return (
    <DummyProvider>
      <TestReact />
    </DummyProvider>
  );
}



