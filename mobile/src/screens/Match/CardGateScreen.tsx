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
  const { user } = useAuth();

  useEffect(() => {
    const socket = getSocket();
    console.log('[CardGate] Setting up listeners for matchId:', matchId);

    // Assume server sends selected cards on match
    socket.on('cards:init', (payload: { cards: Card[] }) => {
      console.log('[CardGate] cards:init received:', payload.cards?.length, 'cards');
      if (payload.cards && payload.cards.length > 0) {
        setCards(payload.cards);
      }
    });
    socket.on(
      'chat:unlocked',
      (payload: {
        sessionId: string;
        partnerId: string;
        partnerNickname: string;
      }) => {
        navigation.replace('Chat', {
          sessionId: payload.sessionId,
          partnerId: payload.partnerId,
          partnerNickname: payload.partnerNickname,
        });
      },
    );
    socket.on('match:ended', (payload: MatchEndedPayload) => {
      console.log('[CardGate] match:ended received:', payload);
      
      // Kullanıcıya bilgi ver ve yeni arama seçeneği sun
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
              // Önce ana ekrana dön, sonra yeni arama başlat
              navigation.popToTop();
              // Kısa gecikme ile yeni aramaya yönlendir
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
    });

    // Ekran açıldığında kartları tekrar iste (cards:init'i kaçırmış olabiliriz)
    if (user) {
      console.log('[CardGate] Emitting cards:request for matchId:', matchId);
      socket.emit('cards:request', { matchId, userId: user.id });
      
      // Kartlar gelmezse tekrar dene (500ms sonra)
      const retryTimeout = setTimeout(() => {
        console.log('[CardGate] Retrying cards:request...');
        socket.emit('cards:request', { matchId, userId: user.id });
      }, 500);
      
      // 3 saniye sonra hala yoksa bir kez daha dene
      const secondRetryTimeout = setTimeout(() => {
        console.log('[CardGate] Second retry for cards:request...');
        socket.emit('cards:request', { matchId, userId: user.id });
      }, 3000);
      
      return () => {
        clearTimeout(retryTimeout);
        clearTimeout(secondRetryTimeout);
        socket.off('cards:init');
        socket.off('chat:unlocked');
        socket.off('match:ended');
      };
    }

    return () => {
      socket.off('cards:init');
      socket.off('chat:unlocked');
      socket.off('match:ended');
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

  if (!current) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={FONTS.body}>Kartlar yükleniyor...</Text>
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
  },
  option: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
  },
});

export default CardGateScreen;

