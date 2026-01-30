import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import ProfilePhoto from '../../components/ProfilePhoto';

type Props = NativeStackScreenProps<any, 'FriendProfile'>;

interface FriendProfile {
  id: string;
  nickname: string;
  bio?: string;
  avatarId?: number;
  isPrime: boolean;
  isOnline: boolean;
  verified: boolean;
  profilePhotos: { id: string; url: string; order: number }[];
  friendshipId: string;
  friendsSince: string;
  monthlySparksEarned: number;
  totalSparksEarned: number;
  lastSeenAt?: string;
}

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
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    loadProfile();
  }, [friendId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/user/friends/${friendId}/profile`);
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch (error) {
      console.error('Profile load error:', error);
      Alert.alert('Hata', 'Profil yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

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

  const currentPhoto = profile.profilePhotos[selectedPhotoIndex]?.url;
  const avatar = getAvatar(profile.avatarId);
  const hasProfilePhoto = profile.isPrime && profile.profilePhotos.length > 0;

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

        {/* Profile Photo or Avatar */}
        <View style={styles.photoSection}>
          {hasProfilePhoto ? (
            <>
              <Image source={{ uri: currentPhoto }} style={styles.mainPhoto} />
              {profile.profilePhotos.length > 1 && (
                <View style={styles.photoIndicators}>
                  {profile.profilePhotos.map((_, index) => (
                    <TouchableOpacity 
                      key={index}
                      onPress={() => setSelectedPhotoIndex(index)}
                      style={[
                        styles.photoIndicator,
                        index === selectedPhotoIndex && styles.photoIndicatorActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={[styles.avatarContainer, { backgroundColor: avatar.color }]}>
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            </View>
          )}
          
          {/* Badges */}
          <View style={styles.badges}>
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
              friendPhoto: currentPhoto,
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
  photoSection: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  mainPhoto: {
    width: '100%',
    height: 350,
    resizeMode: 'cover',
  },
  avatarContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  avatarEmoji: {
    fontSize: 100,
  },
  photoIndicators: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: SPACING.md,
    gap: 6,
  },
  photoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoIndicatorActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  badges: {
    flexDirection: 'row',
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    gap: SPACING.xs,
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
