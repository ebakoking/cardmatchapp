# Socket Memory Leak Fix Guide

## Sorun

React Native component'lerinde socket event listener'lar her render'da yeni oluşturuluyor ve cleanup'ta düzgün kaldırılmıyor.

### ❌ Yanlış Kullanım:

```typescript
useEffect(() => {
  const socket = getSocket();

  // ❌ Inline arrow function - her render'da yeni referans
  socket.on('chat:message', (payload) => {
    setMessages(prev => [...prev, payload]);
  });

  return () => {
    socket.off('chat:message'); // ❌ Reference eşleşmiyor - listener kaldırılmıyor!
  };
}, []);
```

## Çözüm

### ✅ Doğru Kullanım:

```typescript
// Handler'ı useCallback ile tanımla
const handleChatMessage = useCallback((payload) => {
  setMessages(prev => [...prev, payload]);
}, []); // Dependencies: setMessages stable olduğu için boş array OK

useEffect(() => {
  const socket = getSocket();

  // ✅ Aynı reference kullanılıyor
  socket.on('chat:message', handleChatMessage);

  return () => {
    socket.off('chat:message', handleChatMessage); // ✅ Reference eşleşiyor - kaldırılıyor!
  };
}, [handleChatMessage]); // handleChatMessage dependency
```

## ChatScreen.tsx İçin Örnek Düzeltme

### Adım 1: useCallback Import Edildiğinden Emin Ol

```typescript
import React, { useEffect, useState, useRef, useCallback } from 'react';
```

### Adım 2: Handler Fonksiyonlarını useCallback ile Tanımla

```typescript
// ❌ Önce (useEffect içinde inline)
useEffect(() => {
  const socket = getSocket();

  socket.on('chat:message', (payload) => {
    // ...
  });

  socket.on('chat:ended', (payload) => {
    // ...
  });

  return () => {
    socket.off('chat:message');
    socket.off('chat:ended');
  };
}, [sessionId]);

// ✅ Sonra (useCallback ile)
const handleChatMessage = useCallback((payload) => {
  console.log('[ChatScreen] chat:message:', payload);
  setMessages((prev) => [...prev, payload]);
}, []);

const handleChatEnded = useCallback((payload) => {
  console.log('[ChatScreen] chat:ended:', payload);
  if (payload.sessionId !== sessionId) return;
  setIsEnded(true);
  setChatEndReason(payload.reason);
}, [sessionId]); // sessionId dependency gerekli

useEffect(() => {
  const socket = getSocket();

  socket.on('chat:message', handleChatMessage);
  socket.on('chat:ended', handleChatEnded);

  return () => {
    socket.off('chat:message', handleChatMessage);
    socket.off('chat:ended', handleChatEnded);
  };
}, [handleChatMessage, handleChatEnded]);
```

### Adım 3: Tüm Handler'lar İçin Tekrarla

ChatScreen.tsx'de düzeltilmesi gereken handler'lar:
- `handleChatMessage` ✅
- `handleChatTyping` ✅
- `handleStageAdvanced` ✅
- `handleChatEnded` ✅
- `handleGiftReceived` ✅
- `handleGiftSent` ✅
- `handleGiftError` ✅
- `handleFriendInfo` ✅
- `handleFriendAccepted` ✅
- `handleMediaDeleted` ✅
- `handleMediaViewed` ✅
- `handleTokenSpent` ✅
- `handleError` ✅

## Dependencies Dikkat Noktaları

### 1. State Setter Fonksiyonları (useState)

```typescript
const [messages, setMessages] = useState([]);

// ✅ setMessages stable - dependency gerekmez
const handleMessage = useCallback((msg) => {
  setMessages(prev => [...prev, msg]); // Functional update
}, []);
```

### 2. Props ve State Değerleri

```typescript
const handleChatEnded = useCallback((payload) => {
  if (payload.sessionId !== sessionId) return; // sessionId kullanılıyor
  setIsEnded(true);
}, [sessionId]); // ← sessionId dependency olmalı
```

### 3. Context Fonksiyonları

```typescript
const { updateTokenBalance } = useAuth();

const handleGiftReceived = useCallback((payload) => {
  updateTokenBalance(payload.newBalance);
}, [updateTokenBalance]); // ← updateTokenBalance dependency olmalı
```

## Services/socket.ts Düzeltmeleri

### ✅ Reconnection Logic Eklendi:

```typescript
socket.on('connect', () => {
  // Rejoin user room on reconnect
  if (joinedUserId) {
    socket.emit('user:join', { userId: joinedUserId });
  }
});
```

### ✅ Reconnection Retry Config:

```typescript
socket = io(socketUrl, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

## Test Etme

### 1. Memory Leak Test:

```bash
# React Native'de:
# 1. Screen'e git
# 2. Geri dön
# 3. Tekrar git
# 4. Tekrar dön
# 5. Console'da "Cleanup" logları görmeli
```

### 2. Reconnection Test:

```bash
# 1. Uygulamayı aç
# 2. Network'ü kapat (Airplane mode)
# 3. 5 saniye bekle
# 4. Network'ü aç
# 5. Console'da "Reconnected - rejoining user room" logunu görmeli
```

## Uygulanması Gereken Dosyalar

1. ✅ `mobile/src/services/socket.ts` - TAMAMLANDI
2. ⚠️ `mobile/src/screens/Chat/ChatScreen.tsx` - ÖRNEK VERİLDİ
3. ⚠️ `mobile/src/screens/Friends/FriendChatScreen.tsx` - AYNI PATTERN
4. ✅ `mobile/src/context/AuthContext.tsx` - ZATEN DOĞRU

## Özet

- ✅ Handler'ları `useCallback` ile tanımla
- ✅ Cleanup'ta aynı reference ile `socket.off()` çağır
- ✅ Dependencies doğru ayarla
- ✅ Reconnection logic ekle
- ✅ Test et
