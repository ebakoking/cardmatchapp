import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { ProfileStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import ProfilePhoto from '../../components/ProfilePhoto';

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

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, refreshProfile } = useAuth();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bio, setBio] = useState(user?.bio ?? '');
  
  // Kullanıcının avatar'ını bul
  const currentAvatar = AVATARS.find(a => a.id === (user?.avatarId || 1)) || AVATARS[0];

  // Ekran focus olduğunda profili yenile (spark güncellemesi için)
  useFocusEffect(
    useCallback(() => {
      console.log('[ProfileScreen] Screen focused, refreshing profile...');
      refreshProfile();
    }, [refreshProfile])
  );

  const saveBio = async () => {
    try {
      // Sadece bio alanını gönder
      await api.put('/api/user/me', { bio });
      await refreshProfile();
      setEditModalVisible(false);
    } catch {
      // TODO toast
    }
  };

  if (!user) return null;

  const primaryPhoto = user.profilePhotos?.[0]?.url;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {/* Avatar veya Profil Fotoğrafı */}
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={() => navigation.navigate('AvatarSelection')}
        >
          {primaryPhoto ? (
            <ProfilePhoto
              uri={primaryPhoto}
              size={80}
              online={user.isOnline}
            />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: currentAvatar.color }]}>
              <Text style={styles.avatarEmoji}>{currentAvatar.emoji}</Text>
            </View>
          )}
          <View style={styles.editAvatarBadge}>
            <Text style={styles.editAvatarText}>✏️</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.nicknameRow}>
          <Text style={FONTS.h2}>{user.nickname}</Text>
          {user.isPrime && (
            <View style={styles.primeBadge}>
              <Text style={styles.primeBadgeText}>👑 PRIME</Text>
            </View>
          )}
        </View>
        <Text style={FONTS.caption}>{user.bio || 'Bio yok'}</Text>
        
        {/* Jeton ve Spark Bilgileri */}
        <View style={styles.tokenStats}>
          <View style={styles.tokenStat}>
            <Text style={styles.tokenValue}>💎 {user.tokenBalance}</Text>
            <Text style={styles.tokenLabel}>Jeton</Text>
          </View>
          <View style={styles.tokenDivider} />
          <View style={styles.tokenStat}>
            <Text style={styles.tokenValue}>✨ {user.totalSparksEarned || 0}</Text>
            <Text style={styles.tokenLabel}>Spark</Text>
          </View>
          <View style={styles.tokenDivider} />
          <View style={styles.tokenStat}>
            <Text style={styles.tokenValue}>🔥 {user.monthlySparksEarned || 0}</Text>
            <Text style={styles.tokenLabel}>Bu Ay</Text>
          </View>
        </View>
        
        {/* Spark Açıklaması */}
        <Text style={styles.sparkInfo}>
          ✨ Spark: Gönderdiğin medyalar açıldığında kazandığın puanlar
        </Text>
      </View>

      <FlatList
        data={user.profilePhotos || []}
        numColumns={3}
        style={styles.photoGrid}
        contentContainerStyle={{ gap: SPACING.sm }}
        columnWrapperStyle={{ gap: SPACING.sm }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.photoContainer}>
            <Image source={{ uri: item.url }} style={styles.photo} />
            {item.caption ? (
              <View style={styles.captionOverlay}>
                <Text style={styles.captionText} numberOfLines={1}>
                  {item.caption}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      />

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setEditModalVisible(true)}
        >
          <Text style={FONTS.button}>Profili Düzenle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Text style={FONTS.button}>Ayarlar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={logout}>
          <Text style={[FONTS.button, { color: COLORS.danger }]}>
            Çıkış Yap
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={FONTS.h3}>Bio Düzenle</Text>
            <TextInput
              style={styles.textarea}
              value={bio}
              onChangeText={(text) => text.length <= 150 && setBio(text)}
              multiline
              numberOfLines={4}
              placeholder="Bio yaz..."
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={FONTS.button}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.primary }]}
                onPress={saveBio}
              >
                <Text style={FONTS.button}>Kaydet</Text>
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
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 40,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  editAvatarText: {
    fontSize: 14,
  },
  tokenStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  tokenStat: {
    alignItems: 'center',
    flex: 1,
  },
  tokenValue: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  tokenLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tokenDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.textMuted,
    opacity: 0.3,
  },
  sparkInfo: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  primeBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  primeBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  photoGrid: {
    marginTop: SPACING.lg,
  },
  photoContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: 100,
    height: 130,
    borderRadius: 12,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
  },
  captionText: {
    color: COLORS.text,
    fontSize: 10,
    textAlign: 'center',
  },
  actions: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    width: '90%',
  },
  textarea: {
    marginTop: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

export default ProfileScreen;
