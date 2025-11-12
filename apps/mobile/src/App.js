
import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={{flex:1, backgroundColor:'#0b0f13'}}>
      <View style={{padding:16}}>
        <Text style={{color:'#e3f7ff', fontSize:20, fontWeight:'600'}}>ArchiFlow Studio — Mobile</Text>
        <Text style={{color:'#9dcfe0', marginTop:8}}>
          Placeholder: el renderer móvil se integra en siguiente iteración.
          Por ahora verifica el renderer web (apps/web) con selección y movimiento.
        </Text>
        <StatusBar style="light" />
      </View>
    </SafeAreaView>
  );
}
