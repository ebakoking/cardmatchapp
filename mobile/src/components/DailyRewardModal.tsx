import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DailyRewardModalProps {
  visible: boolean;
  onClose: () => void;
}

interface RewardDay {
  day: number;
  tokens: number;
  label: string;
}

interface RewardStatus {
  canClaim: boolean;
  currentStreak: number;
  longestStreak: number;
  nextReward: RewardDay;
  allRewards: RewardDay[];
}

const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ visible, onClose }) => {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<RewardStatus | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimedTokens, setClaimedTokens] = useState(0);
  
  // Animation
  const scaleAnim = useState(new Animated.Value(0))[0];
  const bounceAnim = useState(new Animated.Value(1))[0];

  useEffect(() => {
    if (visible) {
      fetchStatus();
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      scaleAnim.setValue(0);
      setClaimed(false);
    }
  }, [visible]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/daily-reward/status');
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch (error) {
      console.error('Daily reward status error:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    if (!status?.canClaim || claiming) return;

    try {
      setClaiming(true);
      const res = await api.post('/api/daily-reward/claim');
      
      if (res.data.success) {
        setClaimedTokens(res.data.data.tokensEarned);
        setClaimed(true);
        
        // Bounce animation
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 3,
          }),
        ]).start();

        // Refresh profile to update token balance
        await refreshProfile();
        
        // Refetch status
        await fetchStatus();
      }
    } catch (error: any) {
      console.error('Claim reward error:', error);
    } finally {
      setClaiming(false);
    }
  };

  const renderRewardDay = (reward: RewardDay, index: number) => {
    const currentDay = status?.nextReward.day || 1;
    const isPast = index + 1 < currentDay && status?.canClaim;
    const isCurrent = index + 1 === currentDay;
    const isNext = index + 1 > currentDay || !status?.canClaim;

    return (
      <View
        key={reward.day}
        style={[
          styles.dayBox,
          isPast && styles.dayBoxPast,
          isCurrent && styles.dayBoxCurrent,
        ]}
      >
        {isPast && (
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} style={styles.dayCheck} />
        )}
        <Text style={[styles.dayLabel, isCurrent && styles.dayLabelCurrent]}>
          {reward.day}. Gün
        </Text>
        <Text style={[styles.dayTokens, isCurrent && styles.dayTokensCurrent]}>
          💎 {reward.tokens}
        </Text>
        {reward.day === 7 && <Text style={styles.bonusLabel}>BONUS</Text>}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : claimed ? (
            // Claimed State
            <View style={styles.content}>
              <Animated.View style={{ transform: [{ scale: bounceAnim }] }}>
                <Text style={styles.claimedEmoji}>🎉</Text>
              </Animated.View>
              <Text style={styles.claimedTitle}>Tebrikler!</Text>
              <Text style={styles.claimedTokens}>+{claimedTokens} 💎</Text>
              <Text style={styles.claimedSubtitle}>
                {status?.currentStreak} günlük seri!
              </Text>
              <TouchableOpacity style={styles.claimButton} onPress={onClose}>
                <Text style={styles.claimButtonText}>Harika!</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // Normal State
            <View style={styles.content}>
              <Text style={styles.title}>🎁 Günlük Ödül</Text>
              <Text style={styles.subtitle}>
                Her gün giriş yap, ücretsiz elmas kazan!
              </Text>

              {/* Streak Info */}
              <View style={styles.streakContainer}>
                <View style={styles.streakItem}>
                  <Text style={styles.streakValue}>🔥 {status?.currentStreak || 0}</Text>
                  <Text style={styles.streakLabel}>Seri</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakItem}>
                  <Text style={styles.streakValue}>🏆 {status?.longestStreak || 0}</Text>
                  <Text style={styles.streakLabel}>En İyi</Text>
                </View>
              </View>

              {/* Reward Days Grid */}
              <View style={styles.daysGrid}>
                {status?.allRewards.map((reward, index) => renderRewardDay(reward, index))}
              </View>

              {/* Claim Button */}
              {status?.canClaim ? (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={claimReward}
                  disabled={claiming}
                >
                  {claiming ? (
                    <ActivityIndicator color={COLORS.text} />
                  ) : (
                    <Text style={styles.claimButtonText}>
                      {status.nextReward.tokens} 💎 Al!
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.claimedContainer}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
                  <Text style={styles.claimedText}>Bugünkü ödülünü aldın!</Text>
                  <Text style={styles.comeBackText}>Yarın tekrar gel 👋</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    width: '90%',
    maxWidth: 360,
    padding: SPACING.lg,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    zIndex: 10,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  streakItem: {
    flex: 1,
    alignItems: 'center',
  },
  streakDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  streakValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  streakLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  dayBox: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayBoxPast: {
    opacity: 0.5,
  },
  dayBoxCurrent: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(108, 92, 231, 0.15)',
  },
  dayCheck: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  dayLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontSize: 10,
  },
  dayLabelCurrent: {
    color: COLORS.primary,
  },
  dayTokens: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  dayTokensCurrent: {
    color: COLORS.primary,
  },
  bonusLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 2,
  },
  claimButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    minWidth: 200,
    alignItems: 'center',
  },
  claimButtonText: {
    ...FONTS.button,
    color: COLORS.text,
    fontSize: 18,
  },
  claimedContainer: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  claimedText: {
    ...FONTS.body,
    color: COLORS.success,
    fontWeight: '600',
  },
  comeBackText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  // Claimed state
  claimedEmoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  claimedTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  claimedTokens: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.primary,
    marginVertical: SPACING.sm,
  },
  claimedSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
});

export default DailyRewardModal;
