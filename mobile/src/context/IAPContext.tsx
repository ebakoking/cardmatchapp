import React, { useContext } from 'react';
import { Platform } from 'react-native';

/** Satın alma başarılı olduğunda dönen veri (expo-iap Purchase ile uyumlu) */
export interface PurchaseResult {
  productId: string;
  transactionId?: string;
  purchaseToken?: string;
  transactionReceipt?: string;
  [key: string]: unknown;
}

export interface IAPContextValue {
  isReady: boolean;
  purchaseItem: (sku: string, options?: { type?: 'in-app' | 'subs' }) => Promise<PurchaseResult>;
  finishTransaction: (purchase: PurchaseResult, isConsumable: boolean) => Promise<void>;
  products: Array<{ id: string; title?: string; displayPrice?: string; [key: string]: unknown }>;
  subscriptions: Array<{ id: string; title?: string; displayPrice?: string; [key: string]: unknown }>;
}

export const IAPContext = React.createContext<IAPContextValue | null>(null);

/** Web / Expo Go / expo-iap yokken kullanılan mock */
export const MOCK_IAP_VALUE: IAPContextValue = {
  isReady: false,
  products: [],
  subscriptions: [],
  purchaseItem: async () => {
    throw new Error('Uygulama içi satın alma bu ortamda kullanılamaz. Development build veya TestFlight ile deneyin.');
  },
  finishTransaction: async () => {},
};

/** expo-iap yüklüyse gerçek provider'ı kullan, değilse mock (crash önlenir) */
let RealProvider: React.ComponentType<{ children: React.ReactNode }> | null = null;
try {
  RealProvider = require('./IAPProviderReal').IAPProviderReal;
} catch {
  RealProvider = null;
}

export function IAPProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <IAPContext.Provider value={MOCK_IAP_VALUE}>
        {children}
      </IAPContext.Provider>
    );
  }
  if (RealProvider) {
    return <RealProvider>{children}</RealProvider>;
  }
  return (
    <IAPContext.Provider value={MOCK_IAP_VALUE}>
      {children}
    </IAPContext.Provider>
  );
}

export function useIAPContext(): IAPContextValue {
  const ctx = useContext(IAPContext);
  return ctx ?? MOCK_IAP_VALUE;
}
