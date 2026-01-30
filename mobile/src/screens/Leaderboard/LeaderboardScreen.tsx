import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ProfilePhoto from '../../components/ProfilePhoto';

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
  monthlyTokensEarned: number;
  monthlySparksEarned?: number;
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
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [eligibility, setEligibility] = useState<RewardEligibility | null>(null);
  const [claimModalVisible, setClaimModalVisible] = useState(false);
  const [contactInfo, setContactInfo] = useState('');
  const [claiming, setClaiming] = useState(false);

  const loadLeaderboard = async () => {
    try {
      const res = await api.get<{ success: boolean; data: LeaderboardEntry[] }>(
        '/api/leaderboard',
      );
      setEntries(res.data.data);
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

  // Ekran her odaklandığında yenile
  useFocusEffect(
    useCallback(() => {
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
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getAvatar = (avatarId: number = 1) => {
    return AVATARS.find((a) => a.id === avatarId) || AVATARS[0];
  };

  const userRank = entries.findIndex((e) => e.id === user?.id) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={[FONTS.h2, { padding: SPACING.xl }]}>Aylık Liderlik Tablosu</Text>
      <Text style={[FONTS.caption, { paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm }]}>
        Fotoğraf ve video gönderip başkalarının açmasını sağla, spark kazan!
      </Text>

      {/* Ödül Talebi Bannerı */}
      {eligibility?.isEligible && !eligibility.alreadyClaimed && (
        <TouchableOpacity
          style={styles.rewardBanner}
          onPress={() => setClaimModalVisible(true)}
        >
          <View style={styles.rewardBannerContent}>
            <Text style={styles.rewardBannerEmoji}>🏆</Text>
            <View style={styles.rewardBannerText}>
              <Text style={styles.rewardBannerTitle}>
                Tebrikler! {eligibility.rank}. sıradasın
              </Text>
              <Text style={styles.rewardBannerSubtitle}>
                ₺{eligibility.rewardAmount} ödül kazandın! Talep et →
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {eligibility?.alreadyClaimed && (
        <View style={styles.claimedBanner}>
          <Text style={styles.claimedText}>
            ✅ Ödül talebiniz alındı ({eligibility.claimStatus})
          </Text>
        </View>
      )}

      {/* Kullanıcının Kendi Sıralaması */}
      {userRank > 3 && userRank <= 50 && (
        <View style={styles.userRankBanner}>
          <Text style={styles.userRankText}>
            Sen şu an {userRank}. sıradasın • ✨ {user?.monthlySparksEarned || 0} Spark
          </Text>
          <Text style={styles.userRankSubtext}>
            İlk 3'e girmek için daha çok spark kazan!
          </Text>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={FONTS.h3}>Henüz kimse spark kazanmadı 🏆</Text>
            <Text style={[FONTS.caption, { marginTop: SPACING.sm, textAlign: 'center' }]}>
              Fotoğraf veya video gönder, birisi açınca spark kazan!
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const rank = index + 1;
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
                  <Text style={styles.medalText}>{medal}</Text>
                ) : (
                  <Text style={styles.rankText}>{rank}</Text>
                )}
              </View>
              {item.profilePhoto ? (
                <ProfilePhoto uri={item.profilePhoto} size={44} />
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: avatar.color }]}>
                  <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={[FONTS.body, isCurrentUser && styles.currentUserText]}>
                  {item.nickname} {isCurrentUser && '(Sen)'}
                </Text>
                <Text style={styles.sparkText}>
                  ✨ {item.monthlySparksEarned || item.monthlyTokensEarned} Spark
                </Text>
              </View>
              {rank <= 3 && (
                <View style={styles.prizeIndicator}>
                  <Text style={styles.prizeText}>
                    {rank === 1 ? '₺500' : rank === 2 ? '₺300' : '₺150'}
                  </Text>
                </View>
              )}
            </View>
          );
        }}
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
            <Text style={styles.modalTitle}>🏆 Ödül Talebi</Text>
            <Text style={styles.modalSubtitle}>
              Tebrikler! {eligibility?.rank}. sırada bitirdin ve ₺{eligibility?.rewardAmount} ödül kazandın!
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
                <Text style={styles.claimButtonText}>
                  {claiming ? 'Gönderiliyor...' : 'Talep Et'}
                </Text>
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
  rewardBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 12,
    padding: SPACING.md,
  },
  rewardBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#FFD700',
    fontWeight: '600',
  },
  rewardBannerSubtitle: {
    ...FONTS.caption,
    color: '#FFD700',
  },
  claimedBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  claimedText: {
    ...FONTS.body,
    color: COLORS.success,
  },
  userRankBanner: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  userRankText: {
    ...FONTS.body,
    color: COLORS.text,
  },
  userRankSubtext: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    marginTop: SPACING.xl * 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  currentUserRow: {
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  topThreeRow: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  currentUserText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  medalText: {
    fontSize: 24,
  },
  rankText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  sparkText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  prizeIndicator: {
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prizeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
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
  },
  cancelButtonText: {
    ...FONTS.button,
    color: COLORS.textSecondary,
  },
  claimButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonText: {
    ...FONTS.button,
    color: '#000',
  },
});

export default LeaderboardScreen;
