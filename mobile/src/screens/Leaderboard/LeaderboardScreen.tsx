import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MainTabParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ProfilePhoto from '../../components/ProfilePhoto';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<MainTabParamList, 'Leaderboard'>;

// Avatar listesi
const AVATARS = [
  { id: 1, emoji: '👤', color: '#6C5CE7' },
  { id: 2, emoji: '👩', color: '#E84393' },
  { id: 3, emoji: '🧔', color: '#00B894' },
  { id: 4, emoji: '👩‍🦱', color: '#FDCB6E' },
  { id: 5, emoji: '🤓', color: '#0984E3' },
  { id: 6, emoji: '🧢', color: '#D63031' },
  { id: 7, emoji: '🎧', color: '#00CEC9' },
  { id: 8, emoji: '👱‍♀️', color: '#A29BFE' },
];

interface LeaderboardEntry {
  id: string;
  nickname: string;
  avatarId?: number;
  profilePhoto?: string;
  isPrime?: boolean;
  isPlus?: boolean;
  isBoostActive?: boolean;
  monthlySparksEarned: number;
  totalSparksEarned?: number;
  rank: number;
  reward?: number | null;
}

interface CurrentUser {
  id: string;
  nickname: string;
  avatarId?: number;
  monthlySparksEarned: number;
  totalSparksEarned: number;
  rank: number | null;
  hasEventAccess: boolean;
  eventAccessGrantedAt?: string | null;
}

interface LeaderboardGoals {
  sparkForTop3: number;
  sparkForEventAccess: number;
  eventAccessMinSpark: number;
}

interface LeaderboardResponse {
  topUsers: LeaderboardEntry[];
  currentUser: CurrentUser | null;
  goals: LeaderboardGoals;
  totalParticipants: number;
}

interface RewardEligibility {
  isEligible: boolean;
  rank: number | null;
  sparksEarned: number;
  rewardAmount: number | null;
  alreadyClaimed: boolean;
  claimStatus: string | null;
}

const LeaderboardScreen: React.FC<Props> = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [eligibility, setEligibility] = useState<RewardEligibility | null>(null);
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [contactInfo, setContactInfo] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [sparkAnim] = useState(new Animated.Value(0));

  const loadLeaderboard = async () => {
    try {
      const res = await api.get<{ success: boolean; data: LeaderboardResponse }>(
        '/api/leaderboard',
      );
      setData(res.data.data);
      
      // Spark animasyonu
      Animated.spring(sparkAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    } catch {
      // TODO toast
    }
  };

  const loadEligibility = async () => {
    try {
      const res = await api.get<RewardEligibility>('/api/rewards/eligibility');
      setEligibility(res.data);
    } catch {
      // Ödül sistemi opsiyonel, hata gösterme
    }
  };

  useFocusEffect(
    useCallback(() => {
      sparkAnim.setValue(0);
      loadLeaderboard();
      loadEligibility();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLeaderboard(), loadEligibility()]);
    setRefreshing(false);
  };

  const handleClaimReward = async () => {
    if (!contactInfo.trim() || contactInfo.length < 10) {
      Alert.alert('Hata', 'Lütfen geçerli bir iletişim bilgisi (IBAN veya telefon) girin.');
      return;
    }

    try {
      setClaiming(true);
      const res = await api.post('/api/rewards/claim', { contactInfo });
      Alert.alert('Başarılı', res.data.message || 'Ödül talebiniz oluşturuldu.');
      setClaimModalVisible(false);
      setContactInfo('');
      loadEligibility();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.error || 'Talep oluşturulamadı.');
    } finally {
      setClaiming(false);
    }
  };

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
    if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
    return null;
  };

  const getAvatar = (avatarId: number = 1) => {
    return AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const currentUser = data?.currentUser;
  const goals = data?.goals;

  // Progress bar için yüzde hesaplama
  const eventAccessProgress = currentUser && goals
    ? Math.min(100, (currentUser.monthlySparksEarned / goals.eventAccessMinSpark) * 100)
    : 0;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Başlık */}
      <View style={styles.titleSection}>
        <Text style={styles.title}>Aylık Liderlik Tablosu</Text>
        <Text style={styles.subtitle}>
          Fotoğraf ve video gönder, birisi açınca spark kazan!
        </Text>
      </View>

      {/* Kullanıcı Kartı */}
      {currentUser && (
        <Animated.View 
          style={[
            styles.userCard,
            {
              transform: [{ scale: sparkAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              })}],
              opacity: sparkAnim,
            }
          ]}
        >
          <LinearGradient
            colors={[COLORS.primary + '30', COLORS.accent + '20']}
            style={styles.userCardGradient}
          >
            <View style={styles.userCardTop}>
              <View style={styles.userCardRank}>
                {currentUser.rank ? (
                  <>
                    <Text style={styles.userRankNumber}>{currentUser.rank}</Text>
                    <Text style={styles.userRankLabel}>sıra</Text>
                  </>
                ) : (
                  <Text style={styles.userRankLabel}>Sıralama dışı</Text>
                )}
              </View>
              <View style={styles.userCardSparks}>
                <Ionicons name="sparkles" size={24} color={COLORS.accent} />
                <Text style={styles.userSparkCount}>
                  {formatNumber(currentUser.monthlySparksEarned)}
                </Text>
                <Text style={styles.userSparkLabel}>Spark</Text>
              </View>
            </View>

            {/* Hedefler */}
            {goals && goals.sparkForTop3 > 0 && (
              <View style={styles.goalBanner}>
                <Ionicons name="trophy" size={16} color="#FFD700" />
                <Text style={styles.goalText}>
                  Top 3 için {formatNumber(goals.sparkForTop3)} spark daha!
                </Text>
              </View>
            )}

            {/* Event Access Progress */}
            <View style={styles.eventAccessSection}>
              <View style={styles.eventAccessHeader}>
                <View style={styles.eventAccessLabel}>
                  <Ionicons name="star" size={16} color={COLORS.accent} />
                  <Text style={styles.eventAccessTitle}>Özel Etkinlik Erişimi</Text>
                </View>
                <Text style={styles.eventAccessProgress}>
                  {formatNumber(currentUser.monthlySparksEarned)} / {formatNumber(goals?.eventAccessMinSpark || 10000)}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${eventAccessProgress}%` }]} />
              </View>
              {currentUser.hasEventAccess ? (
                <View style={styles.accessGrantedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.accessGrantedText}>Erişim Kazanıldı!</Text>
                </View>
              ) : goals && goals.sparkForEventAccess > 0 && (
                <Text style={styles.eventAccessHint}>
                  {formatNumber(goals.sparkForEventAccess)} spark daha kazanarak özel etkinliklere erişim hakkı kazan!
                </Text>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      )}

      {/* Ödül Talebi Bannerı */}
      {eligibility?.isEligible && !eligibility.alreadyClaimed && (
        <TouchableOpacity
          style={styles.rewardBanner}
          onPress={() => setClaimModalVisible(true)}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rewardBannerGradient}
          >
            <Text style={styles.rewardBannerEmoji}>🏆</Text>
            <View style={styles.rewardBannerText}>
              <Text style={styles.rewardBannerTitle}>
                Tebrikler! {eligibility.rank}. sıradasın
              </Text>
              <Text style={styles.rewardBannerSubtitle}>
                ₺{eligibility.rewardAmount} ödül kazandın! Talep et →
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#000" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {eligibility?.alreadyClaimed && (
        <View style={styles.claimedBanner}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.claimedText}>
            Ödül talebiniz alındı ({eligibility.claimStatus})
          </Text>
        </View>
      )}

      {/* Toplam Katılımcı */}
      {data && data.totalParticipants > 0 && (
        <View style={styles.participantsRow}>
          <Ionicons name="people" size={16} color={COLORS.textMuted} />
          <Text style={styles.participantsText}>
            {data.totalParticipants} katılımcı
          </Text>
        </View>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: LeaderboardEntry }) => {
    const rank = item.rank;
    const medal = getMedal(rank);
    const isCurrentUser = item.id === user?.id;
    const avatar = getAvatar(item.avatarId);

    return (
      <View
        style={[
          styles.row,
          isCurrentUser && styles.currentUserRow,
          rank <= 3 && styles.topThreeRow,
        ]}
      >
        <View style={styles.rankContainer}>
          {medal ? (
            <Text style={styles.medalText}>{medal.emoji}</Text>
          ) : (
            <Text style={styles.rankText}>{rank}</Text>
          )}
        </View>
        
        <View style={styles.avatarContainer}>
          {item.profilePhoto ? (
            <ProfilePhoto uri={item.profilePhoto} size={48} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: avatar.color }]}>
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            </View>
          )}
          {/* Boost Badge */}
          {item.isBoostActive && (
            <View style={styles.boostBadge}>
              <Ionicons name="rocket" size={10} color="#fff" />
            </View>
          )}
        </View>
        
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.nickname, isCurrentUser && styles.currentUserText]}>
              {item.nickname}
            </Text>
            {isCurrentUser && <Text style={styles.youBadge}>(Sen)</Text>}
            {item.isPrime && <Text style={styles.primeBadge}>👑</Text>}
          </View>
          <View style={styles.sparkRow}>
            <Ionicons name="sparkles" size={12} color={COLORS.accent} />
            <Text style={styles.sparkText}>
              {formatNumber(item.monthlySparksEarned)} Spark
            </Text>
          </View>
        </View>
        
        {item.reward && (
          <View style={[styles.prizeIndicator, rank === 1 && styles.firstPrize]}>
            <Text style={styles.prizeText}>₺{item.reward}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={data?.topUsers || []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Henüz kimse spark kazanmadı</Text>
            <Text style={styles.emptySubtitle}>
              Fotoğraf veya video gönder, birisi açınca spark kazan!
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      {/* Ödül Talep Modal */}
      <Modal
        visible={claimModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClaimModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>🏆</Text>
              <Text style={styles.modalTitle}>Ödül Talebi</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Tebrikler! {eligibility?.rank}. sırada bitirdin ve{'\n'}
              <Text style={styles.rewardAmount}>₺{eligibility?.rewardAmount}</Text> ödül kazandın!
            </Text>

            <Text style={styles.inputLabel}>İletişim Bilgisi (IBAN veya Telefon)</Text>
            <TextInput
              style={styles.input}
              placeholder="TR12 0000 0000 0000 0000 0000 00"
              placeholderTextColor={COLORS.textMuted}
              value={contactInfo}
              onChangeText={setContactInfo}
              autoCapitalize="characters"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setClaimModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.claimButton, claiming && styles.claimButtonDisabled]}
                onPress={handleClaimReward}
                disabled={claiming}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.claimButtonGradient}
                >
                  <Text style={styles.claimButtonText}>
                    {claiming ? 'Gönderiliyor...' : 'Talep Et'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingBottom: SPACING.xl + 20, // Tab bar için ekstra padding
  },
  headerContainer: {
    padding: SPACING.lg,
  },
  titleSection: {
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  // User Card
  userCard: {
    marginBottom: SPACING.lg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  userCardGradient: {
    padding: SPACING.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  userCardRank: {
    alignItems: 'center',
  },
  userRankNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  userRankLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  userCardSparks: {
    alignItems: 'center',
  },
  userSparkCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userSparkLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.md,
    gap: 8,
  },
  goalText: {
    ...FONTS.caption,
    color: '#FFD700',
    fontWeight: '600',
  },
  eventAccessSection: {
    marginTop: SPACING.sm,
  },
  eventAccessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  eventAccessLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventAccessTitle: {
    ...FONTS.caption,
    color: COLORS.text,
    fontWeight: '600',
  },
  eventAccessProgress: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  accessGrantedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  accessGrantedText: {
    ...FONTS.caption,
    color: COLORS.success,
    fontWeight: '600',
  },
  eventAccessHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  // Reward Banner
  rewardBanner: {
    marginBottom: SPACING.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rewardBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  rewardBannerEmoji: {
    fontSize: 32,
    marginRight: SPACING.md,
  },
  rewardBannerText: {
    flex: 1,
  },
  rewardBannerTitle: {
    ...FONTS.body,
    color: '#000',
    fontWeight: '700',
  },
  rewardBannerSubtitle: {
    ...FONTS.caption,
    color: 'rgba(0,0,0,0.7)',
  },
  claimedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: 8,
  },
  claimedText: {
    ...FONTS.body,
    color: COLORS.success,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  participantsText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  // List Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    gap: SPACING.md,
  },
  currentUserRow: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '10',
  },
  topThreeRow: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
  },
  rankContainer: {
    width: 36,
    alignItems: 'center',
  },
  medalText: {
    fontSize: 24,
  },
  rankText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  boostBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.accent,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nickname: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '500',
  },
  currentUserText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  youBadge: {
    ...FONTS.caption,
    color: COLORS.accent,
    fontWeight: '600',
  },
  primeBadge: {
    fontSize: 14,
  },
  sparkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sparkText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  prizeIndicator: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  firstPrize: {
    backgroundColor: '#FFD700',
  },
  prizeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl * 2,
  },
  emptyTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  emptySubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  modalSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  rewardAmount: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 24,
  },
  inputLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    ...FONTS.button,
    color: COLORS.textSecondary,
  },
  claimButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonGradient: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    ...FONTS.button,
    color: '#000',
    fontWeight: '700',
  },
});

export default LeaderboardScreen;
