import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator,
  Animated,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface PartnerProgressPayload {
  matchId: string;
  partnerId: string;
  partnerNickname: string;
  progress: number;
  total: number;
}

type Props = NativeStackScreenProps<ChatStackParamList, 'CardGate'>;

interface Card {
  id: string;
  questionTR: string;
  options: string[];
}

// Avatar emojileri
const AVATARS: Record<number, string> = {
  1: '😊', 2: '😎', 3: '🥳', 4: '🤗', 
  5: '😇', 6: '🤩', 7: '😋', 8: '🧐'
};

const CardGateScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId, partnerNickname, partnerAvatarId, commonInterests, isBoostMatch } = route.params as any;
  const [cards, setCards] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [loadingError, setLoadingError] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [partnerProgress, setPartnerProgress] = useState(0);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const { user } = useAuth();
  
  // Ortak interestler (eğer varsa)
  const sharedInterests: string[] = commonInterests || [];
  
  // Animations
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const partnerPulse = useRef(new Animated.Value(1)).current;
  const optionAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  
  // Refs
  const cardsReceivedRef = useRef(false);
  const matchEndedRef = useRef(false);
  const movedToChatRef = useRef(false);

  // Partner pulse animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(partnerPulse, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(partnerPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [partnerPulse]);

  // Animate options when card changes
  useEffect(() => {
    optionAnims.forEach((anim, i) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: i * 100,
        useNativeDriver: true,
      }).start();
    });
  }, [index, optionAnims]);

  // Update progress animation
  useEffect(() => {
    const total = cards.length || 5;
    Animated.timing(progressAnim, {
      toValue: (index + 1) / total,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [index, cards.length, progressAnim]);

  const requestCards = useCallback(() => {
    if (!user || !matchId) return;
    const socket = getSocket();
    setIsRequesting(true);
    socket.emit('cards:request', { matchId, userId: user.id });
  }, [matchId, user]);

  useEffect(() => {
    const socket = getSocket();

    const handleCardsDeliver = (payload: CardsDeliverPayload) => {
      if (payload.matchId === matchId && payload.cards && payload.cards.length > 0) {
        cardsReceivedRef.current = true;
        setCards(payload.cards);
        setLoadingError(false);
        setIsRequesting(false);
      }
    };

    const handleCardsError = (payload: CardsErrorPayload) => {
      if (payload.matchId === matchId) {
        setIsRequesting(false);
        if (payload.reason === 'no_active_match') {
          Alert.alert('Eşleşme Yenilendi', 'Oyun bulunamadı. Yeniden eşleşme arayabilirsiniz.', [
            { text: 'Yeni Eşleşme Ara', onPress: () => {
              navigation.popToTop();
              setTimeout(() => navigation.navigate('MatchQueue'), 300);
            }},
            { text: 'Ana Sayfa', style: 'cancel', onPress: () => navigation.popToTop() },
          ]);
        } else {
          setLoadingError(true);
        }
      }
    };

    const handleChatUnlocked = (payload: {
      sessionId: string;
      partnerId: string;
      partnerNickname: string;
    }) => {
      movedToChatRef.current = true;
      navigation.replace('Chat', {
        sessionId: payload.sessionId,
        partnerId: payload.partnerId,
        partnerNickname: payload.partnerNickname,
      });
    };

    const handleMatchEnded = (payload: MatchEndedPayload) => {
      matchEndedRef.current = true;
      const reasonText = payload.reason === 'peer_disconnected' 
        ? 'Karşı taraf bağlantısını kaybetti.'
        : payload.reason === 'peer_left'
        ? 'Karşı taraf ayrıldı.'
        : payload.message || 'Eşleşme sona erdi.';
      
      Alert.alert('Eşleşme Sona Erdi', reasonText, [
        { text: 'Yeni Eşleşme Ara', onPress: () => {
          navigation.popToTop();
          setTimeout(() => navigation.navigate('MatchQueue'), 300);
        }},
        { text: 'Ana Sayfa', style: 'cancel', onPress: () => navigation.popToTop() },
      ]);
    };

    const handlePartnerProgress = (payload: PartnerProgressPayload) => {
      if (payload.matchId === matchId) {
        setPartnerProgress(payload.progress);
      }
    };

    socket.on('cards:deliver', handleCardsDeliver);
    socket.on('cards:error', handleCardsError);
    socket.on('chat:unlocked', handleChatUnlocked);
    socket.on('match:ended', handleMatchEnded);
    socket.on('partner:progress', handlePartnerProgress);
    
    if (user && matchId) {
      requestCards();
      
      const retryTimeout1 = setTimeout(() => {
        if (!cardsReceivedRef.current) requestCards();
      }, 2000);
      
      const retryTimeout2 = setTimeout(() => {
        if (!cardsReceivedRef.current) requestCards();
      }, 5000);
      
      const errorTimeout = setTimeout(() => {
        if (!cardsReceivedRef.current) {
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
        socket.off('partner:progress', handlePartnerProgress);
        
        if (!matchEndedRef.current && !movedToChatRef.current) {
          socket.emit('match:leave', { matchId });
        }
      };
    }

    return () => {
      socket.off('cards:deliver', handleCardsDeliver);
      socket.off('cards:error', handleCardsError);
      socket.off('chat:unlocked', handleChatUnlocked);
      socket.off('match:ended', handleMatchEnded);
      socket.off('partner:progress', handlePartnerProgress);
    };
  }, [matchId, navigation, user, requestCards]);

  const current = cards[index];
  const total = cards.length || 5;

  const answer = (optionIndex: number) => {
    if (!current || !user || selectedOption !== null) return;
    
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    }
    
    setSelectedOption(optionIndex);
    
    // Animate selection
    Animated.sequence([
      Animated.timing(cardScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    const socket = getSocket();
    socket.emit('card:answer', {
      matchId,
      userId: user.id,
      cardId: current.id,
      selectedOptionIndex: optionIndex,
    });
    
    // Wait a bit then move to next
    setTimeout(() => {
      if (index < total - 1) {
        // Animate card out
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(cardScale, {
            toValue: 0.9,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Önce animasyonları sıfırla, SONRA index'i güncelle
          // Bu Android'de doğru sıralama için gerekli
          cardOpacity.setValue(1);
          cardScale.setValue(1);
          // Kısa bir gecikme ile index güncelle (Android render için)
          setTimeout(() => {
            setIndex((prev) => prev + 1);
            setSelectedOption(null);
          }, 50);
        });
      } else {
        // All questions answered
        setWaitingForPartner(true);
      }
    }, 400);
  };

  // Error state
  if (loadingError) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <Ionicons name="alert-circle" size={64} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Bir sorun oluştu</Text>
          <Text style={styles.errorText}>Kartlar yüklenemedi. Lütfen tekrar deneyin.</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setLoadingError(false);
              cardsReceivedRef.current = false;
              requestCards();
            }}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Loading state
  if (!current) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Kartlar hazırlanıyor...</Text>
            <Text style={styles.loadingSubtext}>Eşleşmeniz yükleniyor</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Waiting for partner state
  if (waitingForPartner) {
    return (
      <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.gradient}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.waitingContainer}>
            <View style={styles.waitingIcon}>
              <Text style={styles.waitingEmoji}>🎉</Text>
            </View>
            <Text style={styles.waitingTitle}>Harika!</Text>
            <Text style={styles.waitingText}>
              Eşleşmenin sorularını tamamlamasını bekliyoruz
            </Text>
            <View style={styles.partnerProgressContainer}>
              <Animated.View style={[styles.partnerAvatar, { transform: [{ scale: partnerPulse }] }]}>
                <Text style={styles.partnerAvatarEmoji}>
                  {AVATARS[partnerAvatarId || 1]}
                </Text>
              </Animated.View>
              <Text style={styles.partnerProgressText}>
                {partnerProgress}/{total} tamamlandı
              </Text>
            </View>
            <View style={styles.loadingDots}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#1a1a2e']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Progress Header */}
        <View style={styles.header}>
          {/* Progress Avatars */}
          <View style={styles.progressAvatars}>
            {/* My Avatar */}
            <View style={styles.avatarContainer}>
              <View style={[styles.avatarCircle, styles.myAvatar]}>
                <Text style={styles.avatarEmoji}>{AVATARS[user?.avatarId || 1]}</Text>
              </View>
              <Text style={styles.avatarProgress}>{index + 1}/{total}</Text>
            </View>
            
            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            
            {/* Partner Avatar */}
            <View style={styles.avatarContainer}>
              <Animated.View style={[
                styles.avatarCircle, 
                styles.partnerAvatarCircle,
                { transform: [{ scale: partnerPulse }] }
              ]}>
                <Text style={styles.avatarEmoji}>{AVATARS[partnerAvatarId || 1]}</Text>
              </Animated.View>
              <Text style={styles.avatarProgress}>{partnerProgress}/{total}</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]} 
            />
          </View>
          <Text style={styles.progressText}>Kart {index + 1}/{total}</Text>
          
          {/* Common Interests */}
          {sharedInterests.length > 0 && (
            <View style={styles.commonInterestsContainer}>
              <Ionicons name="heart" size={14} color={COLORS.accent} />
              <Text style={styles.commonInterestsText}>
                Ortak: {sharedInterests.slice(0, 3).join(', ')}
                {sharedInterests.length > 3 && ` +${sharedInterests.length - 3}`}
              </Text>
            </View>
          )}
        </View>

        {/* Question Card - key ile Android'de re-render zorla */}
        <Animated.View 
          key={`card-${current.id}`}
          style={[
            styles.cardContainer,
            {
              transform: [{ scale: cardScale }],
              opacity: cardOpacity,
            },
          ]}
        >
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.questionText} numberOfLines={5}>{current.questionTR}</Text>
          </View>
        </Animated.View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {current.options.map((opt, idx) => {
            const isSelected = selectedOption === idx;
            return (
              <Animated.View
                key={`${current.id}-${idx}`}
                style={{
                  opacity: optionAnims[idx],
                  transform: [{
                    translateY: optionAnims[idx].interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  }],
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => answer(idx)}
                  disabled={selectedOption !== null}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <View style={[
                      styles.optionIndicator,
                      isSelected && styles.optionIndicatorSelected,
                    ]}>
                      {isSelected ? (
                        <Ionicons name="checkmark" size={16} color="#000" />
                      ) : (
                        <Text style={styles.optionLetter}>
                          {String.fromCharCode(65 + idx)}
                        </Text>
                      )}
                    </View>
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}>
                      {opt}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* Partner Status - Anonimlik için nick gösterme */}
        {partnerProgress < index + 1 && (
          <View style={styles.partnerStatus}>
            <Text style={styles.partnerStatusText}>
              Sorulara cevap veriliyor...
            </Text>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  // Header
  header: {
    marginBottom: SPACING.lg,
  },
  progressAvatars: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  myAvatar: {
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
    borderColor: COLORS.primary,
  },
  partnerAvatarCircle: {
    backgroundColor: 'rgba(0, 206, 201, 0.2)',
    borderColor: '#00CEC9',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  avatarProgress: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  vsContainer: {
    marginHorizontal: SPACING.xl,
  },
  vsText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  commonInterestsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    gap: 6,
  },
  commonInterestsText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '500',
  },
  // Card
  cardContainer: {
    marginBottom: SPACING.xl,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: SPACING.xl,
    minHeight: 160,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    marginBottom: SPACING.md,
  },
  questionText: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 32,
  },
  // Options
  optionsContainer: {
    gap: SPACING.sm,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionSelected: {
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
    borderColor: COLORS.primary,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  optionIndicatorSelected: {
    backgroundColor: COLORS.primary,
  },
  optionLetter: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  optionText: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  optionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Partner Status
  partnerStatus: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  partnerStatusText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  loadingSubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  // Error
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF6B6B',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  // Waiting
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(138, 43, 226, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  waitingEmoji: {
    fontSize: 40,
  },
  waitingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  waitingText: {
    fontSize: 16,
    color: COLORS.textMuted,
    marginBottom: SPACING.xl,
  },
  partnerProgressContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  partnerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 206, 201, 0.2)',
    borderWidth: 3,
    borderColor: '#00CEC9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  partnerAvatarEmoji: {
    fontSize: 32,
  },
  partnerProgressText: {
    fontSize: 14,
    color: COLORS.text,
  },
  loadingDots: {
    marginTop: SPACING.lg,
  },
});

export default CardGateScreen;
