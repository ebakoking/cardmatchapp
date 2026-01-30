import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
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
  const { user } = useAuth();

  useEffect(() => {
    const socket = getSocket();
    console.log('[CardGate] ========== SCREEN MOUNTED ==========');
    console.log('[CardGate] matchId:', matchId);
    console.log('[CardGate] userId:', user?.id);
    console.log('[CardGate] socket connected:', socket.connected);

    // cards:init event handler
    const handleCardsInit = (payload: { cards: Card[] }) => {
      console.log('[CardGate] cards:init received:', payload.cards?.length, 'cards');
      if (payload.cards && payload.cards.length > 0) {
        setCards(payload.cards);
        setLoadingError(false);
      }
    };

    // cards:error event handler
    const handleCardsError = (payload: { matchId: string; error: string; message: string }) => {
      console.log('[CardGate] cards:error received:', payload);
      setLoadingError(true);
    };

    // chat:unlocked event handler
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

    // match:ended event handler
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
              setTimeout(() => {
                navigation.navigate('MatchQueue');
              }, 300);
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

    // Event listeners
    socket.on('cards:init', handleCardsInit);
    socket.on('cards:error', handleCardsError);
    socket.on('chat:unlocked', handleChatUnlocked);
    socket.on('match:ended', handleMatchEnded);

    // Kartları iste
    if (user) {
      console.log('[CardGate] Emitting cards:request for matchId:', matchId);
      socket.emit('cards:request', { matchId, userId: user.id });
      
      // Retry 1: 1 saniye sonra
      const retryTimeout1 = setTimeout(() => {
        if (cards.length === 0) {
          console.log('[CardGate] Retry 1: cards:request...');
          socket.emit('cards:request', { matchId, userId: user.id });
        }
      }, 1000);
      
      // Retry 2: 3 saniye sonra
      const retryTimeout2 = setTimeout(() => {
        if (cards.length === 0) {
          console.log('[CardGate] Retry 2: cards:request...');
          socket.emit('cards:request', { matchId, userId: user.id });
        }
      }, 3000);
      
      // Timeout: 10 saniye sonra hata göster
      const errorTimeout = setTimeout(() => {
        console.log('[CardGate] TIMEOUT: Cards not received after 10 seconds');
        console.log('[CardGate] Debug info:', {
          matchId,
          userId: user.id,
          socketConnected: socket.connected,
          socketId: socket.id,
        });
        setLoadingError(true);
      }, 10000);
      
      return () => {
        clearTimeout(retryTimeout1);
        clearTimeout(retryTimeout2);
        clearTimeout(errorTimeout);
        socket.off('cards:init', handleCardsInit);
        socket.off('cards:error', handleCardsError);
        socket.off('chat:unlocked', handleChatUnlocked);
        socket.off('match:ended', handleMatchEnded);
      };
    }

    return () => {
      socket.off('cards:init', handleCardsInit);
      socket.off('cards:error', handleCardsError);
      socket.off('chat:unlocked', handleChatUnlocked);
      socket.off('match:ended', handleMatchEnded);
    };
  }, [matchId, navigation, user]);

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
            setLoadingError(false);
            const socket = getSocket();
            if (user) {
              socket.emit('cards:request', { matchId, userId: user.id });
            }
          }}
        >
          <Text style={FONTS.button}>Tekrar Dene</Text>
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
        <Text style={FONTS.body}>Kartlar yükleniyor...</Text>
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

