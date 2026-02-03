import React, { useEffect } from 'react';
import { LogBox, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { ChatProvider } from './src/context/ChatContext';
import { IAPProvider } from './src/context/IAPContext';
import { requestNotificationPermission } from './src/services/notifications';

LogBox.ignoreLogs(['Warning: ...']);

export default function App() {
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <IAPProvider>
          <SocketProvider>
            <ChatProvider>
              <RootNavigator />
            </ChatProvider>
          </SocketProvider>
        </IAPProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
