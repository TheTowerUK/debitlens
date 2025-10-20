import React from 'react';
import { View, Text, Pressable } from 'react-native';

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn('UI error caught', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{flex:1, padding:16, justifyContent:'center', alignItems:'center'}}>
          <Text style={{fontWeight:'700', marginBottom:8}}>Something went wrong</Text>
          <Text style={{color:'#DC2626', marginBottom:12}}>{String(this.state.error.message || this.state.error)}</Text>
          <Pressable onPress={() => this.setState({error:null})} style={{borderWidth:1, borderRadius:10, padding:10}}>
            <Text>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
