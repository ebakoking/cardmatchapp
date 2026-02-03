import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
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
import { getPhotoUrl } from '../../utils/photoUrl';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<MainTabParamList, 'Leaderboard'>;

// Avatar listesi
// Avatar listesi - merkezi dosyadan import
import { AVATARS, getAvatar } from '../../constants/avatars';

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


const LeaderboardScreen: React.FC<Props> = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      sparkAnim.setValue(0);
      loadLeaderboard();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaderboard();
    setRefreshing(false);
  };

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', color: '#FFD700' };
    if (rank === 2) return { emoji: '🥈', color: '#C0C0C0' };
    if (rank === 3) return { emoji: '🥉', color: '#CD7F32' };
    return null;
  };

  // getAvatar artık merkezi dosyadan import ediliyor

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
          Ses, fotoğraf ve video gönder, biri açınca spark kazan!
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

            {/* Event Access Progress - 100.000 Spark için */}
            <View style={styles.eventAccessSection}>
              <View style={styles.eventAccessHeader}>
                <View style={styles.eventAccessLabel}>
                  <Ionicons name="star" size={16} color={COLORS.accent} />
                  <Text style={styles.eventAccessTitle}>Özel Etkinlik Erişimi</Text>
                </View>
                <Text style={styles.eventAccessProgress}>
                  {formatNumber(currentUser.monthlySparksEarned)} / {formatNumber(goals?.eventAccessMinSpark || 100000)}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${eventAccessProgress}%` }]} />
              </View>
              {currentUser.hasEventAccess ? (
                <View style={styles.accessGrantedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                  <Text style={styles.accessGrantedText}>Erişim Kazanıldı! Bize ulaşarak ödülünüzü talep edebilirsiniz.</Text>
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

      {/* Toplam Katılımcı - Tam sayı gösterilir */}
      {data && data.totalParticipants > 0 && (
        <View style={styles.participantsRow}>
          <Ionicons name="people" size={16} color={COLORS.textMuted} />
          <Text style={styles.participantsText}>
            {data.totalParticipants.toLocaleString('tr-TR')} katılımcı
          </Text>
          <Text style={styles.participantsHint}> · İlk 100 gösteriliyor</Text>
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
            <ProfilePhoto uri={getPhotoUrl(item.profilePhoto)} size={48} />
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
  participantsHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    opacity: 0.7,
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
});

export default LeaderboardScreen;
