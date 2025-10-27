import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

const DummyProvider = ({ children }) => <>{children}</>;

export default function App() {
  return (
    <DummyProvider>
      <TestReact />
    </DummyProvider>
  );
}



