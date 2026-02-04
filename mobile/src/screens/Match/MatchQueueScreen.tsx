import React, { useEffect, useState, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<ChatStackParamList, 'MatchQueue'>;

const MatchQueueScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const fromV2 = route.params?.fromV2 === true;
  const [searching, setSearching] = useState(true);
  const [searchTime, setSearchTime] = useState(0);
  
  // Track if match was found - don't emit match:leave on successful match
  const matchFoundRef = useRef(false);
  // Track if we're in queue - re-join on socket reconnect (v1 only; v2 uses submit_answers)
  const isInQueueRef = useRef(false);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  // Pulse animation for the center circle
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Rotate animation for the outer ring
  useEffect(() => {
    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotate.start();
    return () => rotate.stop();
  }, []);

  // Fade in animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Search timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSearchTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMatchFound = useCallback((payload: {
    matchId?: string;
    sessionId?: string;
    partnerId?: string;
    partnerNickname: string;
    partnerAvatarId?: number;
    commonInterests?: string[];
    isBoostMatch?: boolean;
    commonAnswers?: number;
  }) => {
    console.log('[MatchQueue] Match found:', payload);
    matchFoundRef.current = true;
    setSearching(false);
    // v2: sessionId + partnerId → Chat; v1: matchId → CardGate
    if (payload.sessionId && payload.partnerId) {
      navigation.replace('Chat', {
        sessionId: payload.sessionId,
        partnerId: payload.partnerId,
        partnerNickname: payload.partnerNickname,
        partnerAvatarId: payload.partnerAvatarId,
      });
    } else {
      navigation.replace('CardGate', {
        matchId: payload.matchId!,
        partnerNickname: payload.partnerNickname,
        partnerAvatarId: payload.partnerAvatarId,
        commonInterests: payload.commonInterests || [],
        isBoostMatch: payload.isBoostMatch || false,
      });
    }
  }, [navigation]);

  const handleMatchBlocked = useCallback((data: { reason: string; message: string }) => {
    console.log('[MatchQueue] Match blocked:', data);
    setSearching(false);
    let title = 'Eşleşme Engellendi';
    let message = data?.message || 'Şu anda eşleşme yapamazsınız.';
    if (data?.reason === 'DAILY_LIMIT') {
      title = 'Günlük Limit';
      message = 'Günlük sohbet limitinizi doldurdunuz. Prime üye olarak sınırsız sohbet başlatabilirsiniz!';
    } else if (data?.reason === 'UNVERIFIED') {
      title = 'Doğrulama Gerekli';
      message = 'Profiliniz henüz onaylanmadı. Lütfen bekleyin.';
    }
    Alert.alert(title, message, [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
  }, [navigation]);

  const handleMatchEnded = useCallback((payload: { reason: string; message?: string }) => {
    console.log('[MatchQueue] match:ended received:', payload);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!user) return;

    const handleConnect = () => {
      if (!fromV2 && isInQueueRef.current) {
        console.log('[MatchQueue] Reconnected - re-joining match queue (v1)');
        socket.emit('match:join', { userId: user.id });
      }
    };

    if (!fromV2) {
      isInQueueRef.current = true;
      console.log('[MatchQueue] Joining queue (v1) with userId:', user.id);
      socket.emit('match:join', { userId: user.id });
    }

    socket.on('connect', handleConnect);
    socket.on('match:found', handleMatchFound);
    socket.on('match:blocked', handleMatchBlocked);
    socket.on('match:ended', handleMatchEnded);

    return () => {
      isInQueueRef.current = false;
      if (!matchFoundRef.current) {
        console.log('[MatchQueue] Leaving queue for userId:', user.id);
        socket.emit('match:leave', { userId: user.id });
      }
      socket.off('connect', handleConnect);
      socket.off('match:found', handleMatchFound);
      socket.off('match:blocked', handleMatchBlocked);
      socket.off('match:ended', handleMatchEnded);
    };
  }, [user?.id, fromV2, handleMatchFound, handleMatchBlocked, handleMatchEnded]);

  const cancel = () => {
    const socket = getSocket();
    if (user) {
      console.log('[MatchQueue] User cancelled, leaving queue:', user.id);
      socket.emit('match:leave', { userId: user.id });
    }
    setSearching(false);
    navigation.goBack();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#0B1020', '#1a1f35', '#0B1020']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Animated Search Circle */}
          <View style={styles.searchCircleContainer}>
            {/* Outer rotating ring */}
            <Animated.View 
              style={[
                styles.outerRing,
                { transform: [{ rotate: rotateInterpolate }] }
              ]}
            >
              <View style={styles.ringDot} />
              <View style={[styles.ringDot, styles.ringDot2]} />
              <View style={[styles.ringDot, styles.ringDot3]} />
            </Animated.View>
            
            {/* Pulsing inner circle */}
            <Animated.View 
              style={[
                styles.pulseCircle,
                { transform: [{ scale: pulseAnim }] }
              ]}
            />
            
            {/* Center icon */}
            <View style={styles.centerCircle}>
              <Ionicons name="search" size={48} color={COLORS.text} />
            </View>
          </View>

          {/* Text */}
          <Text style={styles.title}>Eşleşme Aranıyor</Text>
          <Text style={styles.subtitle}>
            Senin için en uygun kişi aranıyor...
          </Text>
          
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.timerText}>{formatTime(searchTime)}</Text>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 Bilgi</Text>
            <Text style={styles.tipsText}>
              Eşleşme süresi, seçtiğin filtrelere ve aktif kullanıcı sayısına göre değişebilir.
            </Text>
          </View>
        </Animated.View>

        {/* Cancel Button */}
        <TouchableOpacity style={styles.cancelButton} onPress={cancel}>
          <LinearGradient
            colors={['rgba(231, 76, 60, 0.2)', 'rgba(231, 76, 60, 0.1)']}
            style={styles.cancelButtonGradient}
          >
            <Ionicons name="close-circle-outline" size={24} color="#E74C3C" />
            <Text style={styles.cancelButtonText}>İptal Et</Text>
          </LinearGradient>
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.xl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Animated Search Circle
  searchCircleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: COLORS.primary + '30',
    borderStyle: 'dashed',
  },
  ringDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    top: -6,
    left: '50%',
    marginLeft: -6,
  },
  ringDot2: {
    top: '50%',
    left: -6,
    marginTop: -6,
    marginLeft: 0,
    backgroundColor: COLORS.accent,
  },
  ringDot3: {
    top: '50%',
    right: -6,
    left: 'auto',
    marginTop: -6,
    backgroundColor: '#00CEC9',
  },
  pulseCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.primary + '15',
  },
  centerCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  // Text
  title: {
    ...FONTS.h1,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  // Timer
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  timerText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  // Tips
  tipsContainer: {
    marginTop: SPACING.xxl,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    width: SCREEN_WIDTH - SPACING.xl * 2,
    borderWidth: 1,
    borderColor: COLORS.primary + '20',
  },
  tipsTitle: {
    ...FONTS.caption,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  tipsText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  // Cancel Button
  cancelButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  cancelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  cancelButtonText: {
    ...FONTS.button,
    color: '#E74C3C',
    fontWeight: '600',
  },
});

export default MatchQueueScreen;
