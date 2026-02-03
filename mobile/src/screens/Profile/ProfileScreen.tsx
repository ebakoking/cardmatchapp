import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ProfileStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import Constants from 'expo-constants';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import ProfilePhoto from '../../components/ProfilePhoto';
import { getPhotoUrl } from '../../utils/photoUrl';

// Constants
const MAX_CORE_PHOTOS = 6;
const MAX_DAILY_PHOTOS = 3;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = (SCREEN_WIDTH - SPACING.xl * 2 - SPACING.sm * 2) / 3;

// Avatar listesi - merkezi dosyadan import
import { AVATARS, getAvatar } from '../../constants/avatars';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;

interface Photo {
  id: string;
  url: string;
  caption?: string;
  type: 'CORE' | 'DAILY';
  order: number;
}

type TabType = 'core' | 'daily';

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  // 🔴🔴🔴 DEBUG V6 - BU LOGU GÖRÜYORSAN YENİ KOD YÜKLENDİ 🔴🔴🔴
  console.log('🔴🔴🔴 PROFILE SCREEN V6 - RENDER 🔴🔴🔴');
  
  const { user, logout, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('core');
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [captionText, setCaptionText] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Local photo cache - fotoğrafların kaybolmasını önler
  const [cachedPhotos, setCachedPhotos] = useState<Photo[]>([]);
  
  const currentAvatar = getAvatar(user?.avatarId || 1);

  // Fotoğrafları cache'le - user değiştiğinde güncelle (null durumunda cache'i koru)
  React.useEffect(() => {
    if (user?.profilePhotos && user.profilePhotos.length > 0) {
      setCachedPhotos(user.profilePhotos as Photo[]);
    }
  }, [user?.profilePhotos]);

  // Filter photos by type - cache kullan
  const photosToUse = cachedPhotos.length > 0 ? cachedPhotos : (user?.profilePhotos || []) as Photo[];
  const corePhotos = photosToUse.filter((p: Photo) => p.type === 'CORE' || !p.type);
  const dailyPhotos = photosToUse.filter((p: Photo) => p.type === 'DAILY');
  
  // useFocusEffect - KAPATILDI (spam yapıyordu)
  // Focus olunca refreshProfile çağırmıyoruz artık

  // Bio kaydet
  const saveBio = async () => {
    try {
      await api.put('/api/user/me', { bio });
      await refreshProfile();
      setBioModalVisible(false);
    } catch {
      Alert.alert('Hata', 'Bio kaydedilemedi.');
    }
  };

  // Fotoğraf seç ve yükle
  const pickAndUploadPhoto = async (type: 'CORE' | 'DAILY') => {
    const currentCount = type === 'CORE' ? corePhotos.length : dailyPhotos.length;
    const maxCount = type === 'CORE' ? MAX_CORE_PHOTOS : MAX_DAILY_PHOTOS;
    
    if (currentCount >= maxCount) {
      Alert.alert(
        'Limit Doldu',
        type === 'CORE' 
          ? `En fazla ${MAX_CORE_PHOTOS} profil fotoğrafı yükleyebilirsin.`
          : `Bugün için ${MAX_DAILY_PHOTOS} günlük fotoğraf limitine ulaştın.`
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setUploading(true);
      console.log('[ProfileScreen] Uploading photo:', { type, uri: result.assets[0].uri.substring(0, 50) });
      
      const form = new FormData();
      form.append('photo', {
        // @ts-ignore
        uri: result.assets[0].uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
      form.append('type', type);
      
      const response = await api.post('/api/user/me/photos', form);
      console.log('[ProfileScreen] Upload success:', response.data);
      await refreshProfile();
    } catch (error: any) {
      console.error('[ProfileScreen] Upload error:', error.response?.data || error.message);
      const message = error.response?.data?.error?.message || 'Fotoğraf yüklenemedi.';
      Alert.alert('Hata', message);
    } finally {
      setUploading(false);
    }
  };

  // Fotoğraf sil
  const deletePhoto = async (photoId: string) => {
    Alert.alert(
      'Fotoğrafı Sil',
      'Bu fotoğrafı silmek istediğinden emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/user/me/photos/${photoId}`);
              await refreshProfile();
            } catch {
              Alert.alert('Hata', 'Fotoğraf silinemedi.');
            }
          },
        },
      ]
    );
  };

  // Caption düzenleme modalını aç
  const openCaptionModal = (photo: Photo) => {
    setSelectedPhoto(photo);
    setCaptionText(photo.caption || '');
    setCaptionModalVisible(true);
  };

  // Caption kaydet
  const saveCaption = async () => {
    if (!selectedPhoto) return;
    
    try {
      console.log('[ProfileScreen] Saving caption:', { photoId: selectedPhoto.id, caption: captionText });
      const response = await api.patch(`/api/user/me/photos/${selectedPhoto.id}/caption`, {
        caption: captionText,
      });
      console.log('[ProfileScreen] Caption saved:', response.data);
      await refreshProfile();
      setCaptionModalVisible(false);
      setSelectedPhoto(null);
      Alert.alert('Başarılı', 'Açıklama güncellendi.');
    } catch (error: any) {
      console.error('[ProfileScreen] Caption save error:', error.response?.data || error.message);
      Alert.alert('Hata', error.response?.data?.error?.message || 'Açıklama kaydedilemedi.');
    }
  };

  // Fotoğraf değiştir
  const replacePhoto = async (photoId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled) return;

    try {
      setUploading(true);
      const form = new FormData();
      form.append('photo', {
        // @ts-ignore
        uri: result.assets[0].uri,
        name: 'photo.jpg',
        type: 'image/jpeg',
      });
      
      await api.put(`/api/user/me/photos/${photoId}`, form);
      await refreshProfile();
    } catch {
      Alert.alert('Hata', 'Fotoğraf değiştirilemedi.');
    } finally {
      setUploading(false);
    }
  };

  // Fotoğraf seçenekleri göster
  const showPhotoOptions = (photo: Photo) => {
    Alert.alert(
      'Fotoğraf',
      'Ne yapmak istersin?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Açıklama Düzenle', onPress: () => openCaptionModal(photo) },
        { text: 'Fotoğrafı Değiştir', onPress: () => replacePhoto(photo.id) },
        { text: 'Sil', style: 'destructive', onPress: () => deletePhoto(photo.id) },
      ]
    );
  };

  // Çıkış yapma onayı
  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabından çıkış yapmak istediğine emin misin?',
      [
        { text: 'Hayır', style: 'cancel' },
        { 
          text: 'Evet, Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            console.log('[ProfileScreen] Logging out...');
            await logout();
            console.log('[ProfileScreen] Logout complete');
          }
        },
      ]
    );
  };

  // Hesap dondurma onayı
  const handleFreezeAccount = () => {
    Alert.alert(
      'Hesabı Dondur',
      'Hesabını dondurmak istediğine emin misin?\n\n• Profilin arkadaşlarına görünmez olacak\n• Veriler silinmeyecek\n• Aynı telefon numarası ile tekrar giriş yaparak hesabını aktifleştirebilirsin',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Evet, Dondur', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/user/me/freeze-account');
              Alert.alert(
                'Hesap Donduruldu',
                'Hesabın donduruldu. Aynı telefon numarası ile tekrar giriş yaparak aktifleştirebilirsin.',
                [{ text: 'Tamam', onPress: logout }]
              );
            } catch (error) {
              Alert.alert('Hata', 'Hesap dondurulurken bir hata oluştu.');
            }
          }
        },
      ]
    );
  };

  if (!user) return null;

  // Prime kullanıcılar özel profil fotoğrafı seçebilir, diğerleri sadece avatar kullanır
  const hasCustomProfilePhoto = user.isPrime && user.profilePhotoUrl;
  const profilePhotoUrl = hasCustomProfilePhoto ? getPhotoUrl(user.profilePhotoUrl) : null;
  const currentPhotos = activeTab === 'core' ? corePhotos : dailyPhotos;
  const currentMax = activeTab === 'core' ? MAX_CORE_PHOTOS : MAX_DAILY_PHOTOS;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Avatar / Profile Photo */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('AvatarSelection')}
          >
            {profilePhotoUrl ? (
              // Prime kullanıcı özel profil fotoğrafı seçmiş
              <ProfilePhoto uri={profilePhotoUrl} size={80} online={user.isOnline} />
            ) : (
              // Avatar göster (varsayılan)
              <View style={[styles.avatarCircle, { backgroundColor: currentAvatar.color }]}>
                <Text style={styles.avatarEmoji}>{currentAvatar.emoji}</Text>
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarText}>✏️</Text>
            </View>
          </TouchableOpacity>

          {/* Nickname & Prime */}
          <View style={styles.nicknameRow}>
            <Text style={FONTS.h2}>{user.nickname}</Text>
            {user.isPrime && (
              <View style={styles.primeBadge}>
                <Text style={styles.primeBadgeText}>👑 PRIME</Text>
              </View>
            )}
          </View>

          {/* Bio */}
          <TouchableOpacity style={styles.bioContainer} onPress={() => setBioModalVisible(true)}>
            <Text style={styles.bioText}>
              {user.bio || 'Bio ekle...'}
            </Text>
            <View style={styles.privacyHint}>
              <Ionicons name="eye-off-outline" size={12} color={COLORS.textMuted} />
              <Text style={styles.privacyHintText}>Sadece arkadaşların görebilir</Text>
            </View>
          </TouchableOpacity>

          {/* Stats */}
          <View style={styles.tokenStats}>
            <View style={styles.tokenStat}>
              <Text style={styles.tokenValue}>💎 {user.tokenBalance}</Text>
              <Text style={styles.tokenLabel}>Elmas</Text>
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

          {/* Verification Badge / Button */}
          {user.verified ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
              <Text style={styles.verifiedText}>Doğrulanmış Profil</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.verifyButton} 
              onPress={() => navigation.navigate('VerificationSelfie')}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
              <Text style={styles.verifyButtonText}>Profilini Doğrula</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {/* Interests Button */}
          <TouchableOpacity 
            style={styles.interestsButton} 
            onPress={() => navigation.navigate('Interests')}
          >
            <Ionicons name="heart-outline" size={20} color={COLORS.accent} />
            <View style={styles.interestsContent}>
              <Text style={styles.interestsTitle}>İlgi Alanları</Text>
              <Text style={styles.interestsSubtitle}>
                {user.interests && user.interests.length > 0 
                  ? `${user.interests.slice(0, 3).join(', ')}${user.interests.length > 3 ? ` +${user.interests.length - 3}` : ''}`
                  : 'Henüz eklenmedi'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Event Access Badge */}
          {(user as any).hasEventAccess && (
            <TouchableOpacity 
              style={styles.eventAccessBanner}
              onPress={() => Alert.alert(
                '🎉 Özel Etkinlik Erişimi',
                'Tebrikler! Bu ay spark kazanarak özel etkinliklere erişim hakkı kazandınız.\n\nBize ulaşın:\n📧 info@cardmatch.app\n📱 WhatsApp: +90 555 555 5555',
                [
                  { text: 'Tamam', style: 'default' },
                ]
              )}
            >
              <View style={styles.eventAccessContent}>
                <Ionicons name="star" size={24} color="#FFD700" />
                <View style={styles.eventAccessTextContainer}>
                  <Text style={styles.eventAccessTitle}>🎉 Özel Etkinliklere Erişim</Text>
                  <Text style={styles.eventAccessSubtitle}>Bu ay spark hedefine ulaştın! Bize ulaş →</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFD700" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'core' && styles.tabActive]}
            onPress={() => setActiveTab('core')}
          >
            <Text style={[styles.tabText, activeTab === 'core' && styles.tabTextActive]}>
              📸 Fotoğraflar ({corePhotos.length}/{MAX_CORE_PHOTOS})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'daily' && styles.tabActive]}
            onPress={() => setActiveTab('daily')}
          >
            <Text style={[styles.tabText, activeTab === 'daily' && styles.tabTextActive]}>
              ☀️ Bugün ({dailyPhotos.length}/{MAX_DAILY_PHOTOS})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photos Privacy Hint */}
        <View style={styles.photosPrivacyHint}>
          <Ionicons name="eye-off-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.privacyHintText}>Fotoğraflar sadece arkadaşların görebilir</Text>
        </View>

        {/* Photo Grid */}
        <View style={styles.photoGrid}>
          {currentPhotos.map((photo: Photo) => (
            <TouchableOpacity
              key={photo.id}
              style={styles.photoContainer}
              onPress={() => showPhotoOptions(photo)}
              onLongPress={() => showPhotoOptions(photo)}
              delayLongPress={300}
              activeOpacity={0.7}
            >
              <Image source={{ uri: getPhotoUrl(photo.url) }} style={styles.photo} resizeMode="cover" />
              {photo.caption && (
                <View style={styles.captionOverlay}>
                  <Text style={styles.captionText} numberOfLines={1}>
                    {photo.caption}
                  </Text>
                </View>
              )}
              {/* Her zaman düzenleme ikonu göster */}
              <View style={styles.photoEditIcon}>
                <Ionicons name="create-outline" size={16} color={COLORS.text} />
              </View>
            </TouchableOpacity>
          ))}

          {/* Add Photo Button */}
          {currentPhotos.length < currentMax && (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={() => pickAndUploadPhoto(activeTab === 'core' ? 'CORE' : 'DAILY')}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="add" size={32} color={COLORS.primary} />
                  <Text style={styles.addPhotoText}>Ekle</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Daily Info */}
        {activeTab === 'daily' && (
          <Text style={styles.dailyInfo}>
            Günlük fotoğraflar arkadaşlarına "bugün ne yaptığını" gösterir ✨
          </Text>
        )}

        {/* Hesap Ayarları */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Hesap Ayarları</Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('ChangeNickname')}
          >
            <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Kullanıcı Adını Değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('ChangeEmail')}
          >
            <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>E-posta Değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Şifre Değiştir</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Gizlilik & Güvenlik */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Gizlilik & Güvenlik</Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <Ionicons name="ban-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Engellenen Kullanıcılar</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('AppLock')}
          >
            <Ionicons name="finger-print-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Uygulama Kilidi</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Destek */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Destek</Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Help')}
          >
            <Ionicons name="help-circle-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Yardım</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Feedback')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Görüş / Öneri Gönder</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Yasal */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Yasal</Text>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('PrivacyPolicy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Gizlilik Politikası</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('TermsOfService')}
          >
            <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.settingsButtonText}>Kullanım Koşulları</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Çıkış */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            <Text style={[FONTS.button, { color: COLORS.danger }]}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Hesap Dondurma */}
        <TouchableOpacity style={styles.freezeButton} onPress={handleFreezeAccount}>
          <Ionicons name="snow-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.freezeButtonText}>Hesabımı Dondur</Text>
        </TouchableOpacity>

        {/* Sürüm (hangi build yüklü doğrulama) */}
        <Text style={styles.versionText}>
          Sürüm {Constants.expoConfig?.version ?? '—'} (Build {Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '—'})
        </Text>
      </ScrollView>

      {/* Bio Modal */}
      <Modal visible={bioModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={FONTS.h3}>Bio Düzenle</Text>
            <TextInput
              style={styles.textarea}
              value={bio}
              onChangeText={(text) => text.length <= 150 && setBio(text)}
              multiline
              numberOfLines={4}
              placeholder="Kendinden bahset..."
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setBioModalVisible(false)}>
                <Text style={FONTS.button}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={saveBio}>
                <Text style={FONTS.button}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Caption Modal */}
      <Modal visible={captionModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={FONTS.h3}>Fotoğraf Açıklaması</Text>
            <TextInput
              style={styles.textarea}
              value={captionText}
              onChangeText={(text) => text.length <= 80 && setCaptionText(text)}
              placeholder="Açıklama ekle..."
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <Text style={styles.charCount}>{captionText.length}/80</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setCaptionModalVisible(false)}>
                <Text style={FONTS.button}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={saveCaption}>
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
  },
  header: {
    alignItems: 'center',
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  editToggle: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  editToggleText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
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
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
  bioContainer: {
    alignItems: 'center',
  },
  bioText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  privacyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: 4,
  },
  privacyHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    opacity: 0.7,
  },
  photosPrivacyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    gap: 4,
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
  // Verification Badge
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(46, 213, 115, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  verifiedText: {
    ...FONTS.caption,
    color: COLORS.success,
    fontWeight: '600',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  verifyButtonText: {
    ...FONTS.body,
    color: COLORS.primary,
    flex: 1,
  },
  // Interests Button
  interestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  interestsContent: {
    flex: 1,
  },
  interestsTitle: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '500',
  },
  interestsSubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Event Access Banner
  eventAccessBanner: {
    marginTop: SPACING.md,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    overflow: 'hidden',
  },
  eventAccessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  eventAccessTextContainer: {
    flex: 1,
  },
  eventAccessTitle: {
    ...FONTS.body,
    color: '#FFD700',
    fontWeight: '700',
  },
  eventAccessSubtitle: {
    ...FONTS.caption,
    color: 'rgba(255, 215, 0, 0.8)',
    marginTop: 2,
  },
  // Tabs
  tabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
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
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
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
  editOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEditIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  addPhotoText: {
    ...FONTS.caption,
    color: COLORS.primary,
    marginTop: 4,
  },
  dailyInfo: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  // Actions
  actions: {
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  // Settings Section
  settingsSection: {
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sectionTitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontWeight: '600',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingsButtonText: {
    flex: 1,
    marginLeft: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
  },
  freezeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  freezeButtonText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  versionText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  // Modals
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  modalButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: COLORS.primary,
  },
});

export default ProfileScreen;
