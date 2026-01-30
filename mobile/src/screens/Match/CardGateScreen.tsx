import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

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

    // Assume server sends selected cards on match
    socket.on('cards:init', (payload: { cards: Card[] }) => {
      setCards(payload.cards);
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
    socket.on('match:ended', () => {
      navigation.popToTop();
    });

    // Ekran açıldığında kartları tekrar iste (cards:init'i kaçırmış olabiliriz)
    if (user) {
      socket.emit('cards:request', { matchId, userId: user.id });
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

