import React from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// DÜZELTME BURADA: Navigation yerine { RootNavigator } olarak çağırıyoruz
import { RootNavigator } from './src/navigation'; 
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { ChatProvider } from './src/context/ChatContext';

// Sarı uyarıları temizleyelim
LogBox.ignoreLogs(['Warning: ...']); 

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
             {/* DÜZELTME BURADA: İsmi güncelledik */}
             <RootNavigator />
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}