/**
 * Gerçek IAP provider - sadece expo-iap yüklüyken kullanılır.
 * IAPContext try/require ile yükler; expo-iap yoksa crash olmaz.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { useIAP } from 'expo-iap';
import { ALL_IAP_SKUS, IAP_PRODUCT_IDS } from '../constants/iapProducts';
import { IAPContext } from './IAPContext';
import type { IAPContextValue, PurchaseResult } from './IAPContext';

export function IAPProviderReal({ children }: { children: React.ReactNode }) {
  const pendingRef = useRef<{
    resolve: (p: PurchaseResult) => void;
    reject: (e: Error) => void;
    sku: string;
  } | null>(null);

  const {
    connected,
    products,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction: iapFinishTransaction,
  } = useIAP({
    autoFinishTransactions: false,
    onPurchaseSuccess: async (purchase: PurchaseResult) => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        pending.resolve(purchase);
      }
    },
    onPurchaseError: (error) => {
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        const msg = error?.message ?? 'Satın alma başarısız.';
        pending.reject(new Error(msg));
      }
    },
  });

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: ALL_IAP_SKUS, type: 'in-app' }).catch(() => {});
      fetchProducts({
        skus: [
          IAP_PRODUCT_IDS.PRIME_WEEKLY,
          IAP_PRODUCT_IDS.PRIME_MONTHLY,
          IAP_PRODUCT_IDS.PRIME_YEARLY,
        ],
        type: 'subs',
      }).catch(() => {});
    }
  }, [connected, fetchProducts]);

  const purchaseItem = useCallback(
    async (sku: string, options?: { type?: 'in-app' | 'subs' }): Promise<PurchaseResult> => {
      if (!connected) {
        throw new Error('Mağaza henüz hazır değil. Lütfen tekrar deneyin.');
      }
      return new Promise((resolve, reject) => {
        pendingRef.current = { resolve, reject, sku };
        const type = options?.type ?? 'in-app';
        requestPurchase({
          request: {
            apple: { sku },
            google: { skus: [sku] },
          },
          ...(type === 'subs' && { type: 'subs' }),
        }).catch((err) => {
          if (pendingRef.current?.sku === sku) {
            pendingRef.current = null;
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });
      });
    },
    [connected, requestPurchase]
  );

  const finishTransaction = useCallback(
    async (purchase: PurchaseResult, isConsumable: boolean) => {
      await iapFinishTransaction({ purchase, isConsumable });
    },
    [iapFinishTransaction]
  );

  const value: IAPContextValue = {
    isReady: connected,
    products: products ?? [],
    subscriptions: subscriptions ?? [],
    purchaseItem,
    finishTransaction,
  };

  return (
    <IAPContext.Provider value={value}>
      {children}
    </IAPContext.Provider>
  );
}
