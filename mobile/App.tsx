import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { RootNavigator } from './src/navigation'; 
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { ChatProvider } from './src/context/ChatContext';
import { requestNotificationPermission } from './src/services/notifications';

// Gereksiz uyarıları gizle
LogBox.ignoreLogs(['Warning: ...']); 

// Uygulama açılır açılmaz izinleri iste
async function requestPermissions() {
  // 1. Bildirim izni
  await requestNotificationPermission();
  
  // 2. Konum izni
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('[Permissions] Location:', status);
  } catch (error) {
    console.log('[Permissions] Location error:', error);
  }
}

export default function App() {
  useEffect(() => {
    requestPermissions();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <RootNavigator />
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}