import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import BlurredPhoto from '../../components/BlurredPhoto';
import { getPhotoUrl } from '../../utils/photoUrl';

type Props = NativeStackScreenProps<any, 'FriendProfile'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - SPACING.md * 3) / 2; // 2 sütunlu grid

interface ProfilePhoto {
  id: string;
  url: string;
  order: number;
  type: 'CORE' | 'DAILY';
  caption?: string;
  hasCaption?: boolean;
  isUnlocked: boolean;
  unlockCost: number;
  createdAt: string;
}

interface UnlockCosts {
  core: number;
  daily: number;
}

interface FriendProfile {
  id: string;
  nickname: string;
  bio?: string;
  avatarId?: number;
  profilePhotoUrl?: string; // Prime üyeler için özel profil fotoğrafı
  isPrime: boolean;
  isOnline: boolean;
  verified: boolean;
  profilePhotos: ProfilePhoto[];
  corePhotos: ProfilePhoto[];
  dailyPhotos: ProfilePhoto[];
  friendshipId: string;
  friendsSince: string;
  monthlySparksEarned: number;
  totalSparksEarned: number;
  lastSeenAt?: string;
  unlockCosts: UnlockCosts;
}

type TabType = 'core' | 'daily';

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

const FriendProfileScreen: React.FC<Props> = ({ route, navigation }) => {
  const { friendId, friendNickname } = route.params || {};
  const { user, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userBalance, setUserBalance] = useState(user?.tokenBalance || 0);
  const [activeTab, setActiveTab] = useState<TabType>('core');

  useEffect(() => {
    loadProfile();
  }, [friendId]);

  useEffect(() => {
    setUserBalance(user?.tokenBalance || 0);
  }, [user?.tokenBalance]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/user/friends/${friendId}/profile`);
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch (error: any) {
      console.error('Profile load error:', error);
      if (error.response?.status === 403) {
        Alert.alert(
          'Arkadaş Değilsin',
          'Bu profili görmek için arkadaş olmalısın.',
          [{ text: 'Tamam', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Hata', 'Profil yüklenemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fotoğraf açma işlemi
  const handleUnlockPhoto = useCallback(async (photoId: string): Promise<boolean> => {
    try {
      const res = await api.post(`/api/user/photos/${photoId}/unlock`);
      if (res.data.success) {
        // Bakiyeyi güncelle
        setUserBalance(res.data.data.newBalance);
        
        // Profili güncelle (fotoğraf artık açık) - hem corePhotos hem dailyPhotos
        setProfile(prev => {
          if (!prev) return prev;
          
          const updatePhoto = (p: ProfilePhoto) => 
            p.id === photoId ? { ...p, isUnlocked: true, caption: res.data.data.photo?.caption } : p;
          
          return {
            ...prev,
            profilePhotos: prev.profilePhotos?.map(updatePhoto) || [],
            corePhotos: prev.corePhotos?.map(updatePhoto) || [],
            dailyPhotos: prev.dailyPhotos?.map(updatePhoto) || [],
          };
        });

        // Kullanıcı profilini de güncelle (bakiye için)
        refreshProfile();

        if (!res.data.data.alreadyUnlocked) {
          Alert.alert('Fotoğraf Açıldı! ✨', `${res.data.data.sparkAwarded} spark karşı tarafa eklendi.`);
        }
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Photo unlock error:', error);
      if (error.response?.status === 402) {
        Alert.alert('Yetersiz Elmas', error.response.data.error.message);
      } else {
        Alert.alert('Hata', 'Fotoğraf açılamadı.');
      }
      return false;
    }
  }, [refreshProfile]);

  // Elmas satın alma sayfasına git
  const handlePurchaseTokens = useCallback(() => {
    navigation.navigate('Home', {
      screen: 'Profile',
      params: {
        screen: 'TokenPurchase',
      },
    });
  }, [navigation]);

  // Son görülme zamanını formatla
  const formatLastSeen = (lastSeenAt?: string, isOnline?: boolean) => {
    if (isOnline) {
      return 'Çevrimiçi';
    }

    if (!lastSeenAt) {
      return 'Bilinmiyor';
    }

    const now = new Date();
    const lastSeen = new Date(lastSeenAt);
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMinutes < 1) {
      return 'Az önce';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} dakika önce`;
    } else if (diffHours < 24) {
      return `${diffHours} saat önce`;
    } else if (diffDays < 7) {
      return `${diffDays} gün önce`;
    } else if (diffWeeks < 4) {
      return `${diffWeeks} hafta önce`;
    } else if (diffMonths < 12) {
      return `${diffMonths} ay önce`;
    } else {
      return `${diffYears} yıl önce`;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getAvatar = (avatarId?: number) => {
    return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profil bulunamadı</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={FONTS.button}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const avatar = getAvatar(profile.avatarId);
  const hasProfilePhoto = profile.profilePhotos.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={FONTS.h2}>{profile.nickname}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Avatar / Profile Photo Section */}
        <View style={styles.avatarSection}>
          {profile.profilePhotoUrl ? (
            // Prime kullanıcı özel profil fotoğrafı varsa göster
            <Image 
              source={{ uri: getPhotoUrl(profile.profilePhotoUrl) }} 
              style={styles.profilePhoto}
            />
          ) : (
            // Avatar göster
            <View style={[styles.avatarContainer, { backgroundColor: avatar.color }]}>
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            </View>
          )}
          
          {/* Badges */}
          <View style={styles.badgesRow}>
            {profile.isPrime && (
              <View style={styles.badge}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.badgeText}>Prime</Text>
              </View>
            )}
            {profile.verified && (
              <View style={[styles.badge, styles.verifiedBadge]}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.badgeText}>Doğrulanmış</Text>
              </View>
            )}
          </View>
        </View>

        {/* Photo Tabs & Grid */}
        {hasProfilePhoto && (
          <View style={styles.photoGridSection}>
            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'core' && styles.tabActive]}
                onPress={() => setActiveTab('core')}
              >
                <Text style={[styles.tabText, activeTab === 'core' && styles.tabTextActive]}>
                  📸 Profil ({profile.corePhotos?.length || 0})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
                onPress={() => setActiveTab('daily')}
              >
                <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
                  ☀️ Bugün ({profile.dailyPhotos?.length || 0})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Unlock Cost Info */}
            <Text style={styles.photoHint}>
              {activeTab === 'core' 
                ? `Profil fotoğrafları: ${profile.unlockCosts?.core || 5} elmas`
                : `Günlük fotoğraflar: ${profile.unlockCosts?.daily || 3} elmas`
              }
            </Text>

            {/* Photo Grid */}
            <View style={styles.photoGrid}>
              {(activeTab === 'core' ? profile.corePhotos : profile.dailyPhotos)?.map((photo) => (
                <BlurredPhoto
                  key={photo.id}
                  photoId={photo.id}
                  photoUrl={getPhotoUrl(photo.url)}
                  caption={photo.caption}
                  hasCaption={photo.hasCaption}
                  isUnlocked={photo.isUnlocked}
                  unlockCost={photo.unlockCost}
                  userBalance={userBalance}
                  onUnlock={handleUnlockPhoto}
                  onPurchaseTokens={handlePurchaseTokens}
                  style={styles.gridPhoto}
                />
              ))}
            </View>

            {/* Empty State */}
            {((activeTab === 'core' && !profile.corePhotos?.length) ||
              (activeTab === 'daily' && !profile.dailyPhotos?.length)) && (
              <Text style={styles.emptyState}>
                {activeTab === 'core' 
                  ? 'Henüz profil fotoğrafı yok.'
                  : 'Bugün fotoğraf paylaşmamış.'}
              </Text>
            )}
          </View>
        )}

        {/* Online Status */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, profile.isOnline && styles.statusDotOnline]} />
          <Text style={styles.statusText}>
            {formatLastSeen(profile.lastSeenAt, profile.isOnline)}
          </Text>
        </View>

        {/* Bio */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hakkında</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Sparks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Spark Bilgileri</Text>
          <View style={styles.sparkCard}>
            <View style={styles.sparkItem}>
              <Text style={styles.sparkValue}>{profile.monthlySparksEarned}</Text>
              <Text style={styles.sparkLabel}>Aylık Spark</Text>
            </View>
            <View style={styles.sparkDivider} />
            <View style={styles.sparkItem}>
              <Text style={styles.sparkValue}>{profile.totalSparksEarned}</Text>
              <Text style={styles.sparkLabel}>Toplam Spark</Text>
            </View>
          </View>
        </View>

        {/* Friendship Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤝 Arkadaşlık</Text>
          <Text style={styles.friendshipDate}>
            {formatDate(profile.friendsSince)} tarihinden beri arkadaşsınız
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('FriendChat', {
              friendshipId: profile.friendshipId,
              friendNickname: profile.nickname,
              friendPhoto: profile.profilePhotos?.[0]?.isUnlocked ? profile.profilePhotos[0].url : undefined,
              friendOnline: profile.isOnline,
              friendId: profile.id,
            })}
          >
            <Ionicons name="chatbubble" size={20} color={COLORS.text} />
            <Text style={styles.actionText}>Mesaj Gönder</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: SPACING.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginVertical: SPACING.md,
    borderWidth: 3,
    borderColor: '#FFD700', // Prime sarı rengi
  },
  avatarEmoji: {
    fontSize: 60,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: SPACING.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  // Photo Grid
  photoGridSection: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  photoHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  gridPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  emptyState: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.xl,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedBadge: {},
  badgeText: {
    color: COLORS.text,
    fontSize: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.textMuted,
  },
  statusDotOnline: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    ...FONTS.body,
    color: COLORS.text,
  },
  section: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  bioText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  sparkCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sparkItem: {
    flex: 1,
    alignItems: 'center',
  },
  sparkValue: {
    ...FONTS.h1,
    color: COLORS.accent,
  },
  sparkLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  sparkDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  friendshipDate: {
    ...FONTS.body,
    color: COLORS.textSecondary,
  },
  actions: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  actionText: {
    ...FONTS.button,
    color: COLORS.text,
  },
});

export default FriendProfileScreen;
