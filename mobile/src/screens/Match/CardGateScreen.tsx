import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

interface MatchEndedPayload {
  matchId: string;
  reason: 'peer_disconnected' | 'peer_left' | 'timeout' | string;
  message?: string;
}

interface CardsDeliverPayload {
  matchId: string;
  cards: Card[];
}

interface CardsErrorPayload {
  matchId: string;
  reason: string;
  message: string;
}

type Props = NativeStackScreenProps<ChatStackParamList, 'CardGate'>;

interface Card {
  id: string;
  questionTR: string;
  options: string[];
}

const CardGateScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId } = route.params;
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [loadingError, setLoadingError] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const { user } = useAuth();
  
  // Ref to track if cards received (for timeout callbacks)
  const cardsReceivedRef = useRef(false);

  // Request cards function
  const requestCards = useCallback(() => {
    if (!user || !matchId) return;
    
    const socket = getSocket();
    console.log('[CardGate] Emitting cards:request:', { matchId, userId: user.id });
    setIsRequesting(true);
    socket.emit('cards:request', { matchId, userId: user.id });
  }, [matchId, user]);

  useEffect(() => {
    const socket = getSocket();
    console.log('[CardGate] ========== SCREEN MOUNTED ==========');
    console.log('[CardGate] matchId:', matchId);
    console.log('[CardGate] userId:', user?.id);
    console.log('[CardGate] socket.id:', socket.id);
    console.log('[CardGate] socket.connected:', socket.connected);

    // ========== EVENT HANDLERS ==========
    
    // cards:deliver - kartlar geldi (pull-based handshake)
    const handleCardsDeliver = (payload: CardsDeliverPayload) => {
      console.log('[CardGate] cards:deliver received:', payload.matchId, payload.cards?.length, 'cards');
      if (payload.matchId === matchId && payload.cards && payload.cards.length > 0) {
        cardsReceivedRef.current = true;
        setCards(payload.cards);
        setLoadingError(false);
        setIsRequesting(false);
      }
    };

    // cards:error - hata oluştu
    const handleCardsError = (payload: CardsErrorPayload) => {
      console.log('[CardGate] cards:error received:', payload);
      if (payload.matchId === matchId) {
        setLoadingError(true);
        setIsRequesting(false);
      }
    };

    // chat:unlocked - sohbet açıldı
    const handleChatUnlocked = (payload: {
      sessionId: string;
      partnerId: string;
      partnerNickname: string;
    }) => {
      console.log('[CardGate] chat:unlocked received:', payload);
      navigation.replace('Chat', {
        sessionId: payload.sessionId,
        partnerId: payload.partnerId,
        partnerNickname: payload.partnerNickname,
      });
    };

    // match:ended - eşleşme sona erdi
    const handleMatchEnded = (payload: MatchEndedPayload) => {
      console.log('[CardGate] match:ended received:', payload);
      
      const reasonText = payload.reason === 'peer_disconnected' 
        ? 'Karşı taraf bağlantısını kaybetti.'
        : payload.reason === 'peer_left'
        ? 'Karşı taraf ayrıldı.'
        : payload.reason === 'timeout'
        ? 'Süre doldu.'
        : payload.message || 'Eşleşme sona erdi.';
      
      Alert.alert(
        'Eşleşme Sona Erdi',
        reasonText,
        [
          {
            text: 'Yeni Eşleşme Ara',
            onPress: () => {
              navigation.popToTop();
              setTimeout(() => navigation.navigate('MatchQueue'), 300);
            },
          },
          {
            text: 'Ana Sayfa',
            style: 'cancel',
            onPress: () => navigation.popToTop(),
          },
        ]
      );
    };

    // ========== REGISTER LISTENERS FIRST ==========
    socket.on('cards:deliver', handleCardsDeliver);
    socket.on('cards:error', handleCardsError);
    socket.on('chat:unlocked', handleChatUnlocked);
    socket.on('match:ended', handleMatchEnded);
    
    console.log('[CardGate] Event listeners registered');

    // ========== THEN REQUEST CARDS ==========
    if (user && matchId) {
      // İlk istek - hemen
      requestCards();
      
      // Retry 1: 2 saniye sonra (eğer kartlar henüz gelmediyse)
      const retryTimeout1 = setTimeout(() => {
        if (!cardsReceivedRef.current) {
          console.log('[CardGate] Retry 1: cards not received yet');
          requestCards();
        }
      }, 2000);
      
      // Retry 2: 5 saniye sonra
      const retryTimeout2 = setTimeout(() => {
        if (!cardsReceivedRef.current) {
          console.log('[CardGate] Retry 2: cards still not received');
          requestCards();
        }
      }, 5000);
      
      // Timeout: 10 saniye sonra hata göster
      const errorTimeout = setTimeout(() => {
        if (!cardsReceivedRef.current) {
          console.log('[CardGate] TIMEOUT: Cards not received after 10 seconds');
          setLoadingError(true);
          setIsRequesting(false);
        }
      }, 10000);
      
      return () => {
        clearTimeout(retryTimeout1);
        clearTimeout(retryTimeout2);
        clearTimeout(errorTimeout);
        socket.off('cards:deliver', handleCardsDeliver);
        socket.off('cards:error', handleCardsError);
        socket.off('chat:unlocked', handleChatUnlocked);
        socket.off('match:ended', handleMatchEnded);
      };
    }

    return () => {
      socket.off('cards:deliver', handleCardsDeliver);
      socket.off('cards:error', handleCardsError);
      socket.off('chat:unlocked', handleChatUnlocked);
      socket.off('match:ended', handleMatchEnded);
    };
  }, [matchId, navigation, user, requestCards]);

  const current = cards[index];
  const total = cards.length || 5;
  const progress = `${index + 1}/${total}`;

  const answer = (optionIndex: number) => {
    if (!current || !user) return;
    const socket = getSocket();
    socket.emit('card:answer', {
      matchId,
      userId: user.id,
      cardId: current.id,
      selectedOptionIndex: optionIndex,
    });
    if (index < total - 1) {
      setIndex((prev) => prev + 1);
    }
  };

  // Hata durumu - yeniden deneme seçeneği
  if (loadingError) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={[FONTS.h3, { color: COLORS.error || '#FF6B6B', marginBottom: SPACING.md }]}>
          Bir sorun oluştu
        </Text>
        <Text style={[FONTS.body, { color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.xl }]}>
          Kartlar yüklenemedi. Lütfen tekrar deneyin.
        </Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={() => {
            console.log('[CardGate] Retry button pressed');
            setLoadingError(false);
            cardsReceivedRef.current = false;
            requestCards();
          }}
          disabled={isRequesting}
        >
          {isRequesting ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={FONTS.button}>Tekrar Dene</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: COLORS.surface, marginTop: SPACING.md }]} 
          onPress={() => navigation.popToTop()}
        >
          <Text style={FONTS.body}>Ana Sayfa</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Yükleniyor durumu
  if (!current) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[FONTS.body, { marginTop: SPACING.md }]}>Kartlar yükleniyor...</Text>
        <Text style={[FONTS.caption, { marginTop: SPACING.sm, color: COLORS.textMuted }]}>
          Lütfen bekleyin...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={FONTS.caption}>Kart {progress}</Text>
      <Text style={[FONTS.h2, { marginTop: SPACING.lg }]}>
        {current.questionTR}
      </Text>
      <View style={{ marginTop: SPACING.xl, gap: SPACING.md }}>
        {current.options.map((opt, idx) => (
          <TouchableOpacity
            key={opt}
            style={styles.option}
            onPress={() => answer(idx)}
          >
            <Text style={FONTS.body}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  option: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
});

export default CardGateScreen;

