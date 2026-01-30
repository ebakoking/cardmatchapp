import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

// 8 varsayılan avatar - emoji ve renk kombinasyonları
const AVATARS = [
  { id: 1, emoji: '👤', color: '#6C5CE7', name: 'Mor Profil' },
  { id: 2, emoji: '👩', color: '#E84393', name: 'Pembe Kız' },
  { id: 3, emoji: '🧔', color: '#00B894', name: 'Yeşil Sakallı' },
  { id: 4, emoji: '👩‍🦱', color: '#FDCB6E', name: 'Sarı Kıvırcık' },
  { id: 5, emoji: '🤓', color: '#0984E3', name: 'Mavi Gözlüklü' },
  { id: 6, emoji: '🧢', color: '#D63031', name: 'Kırmızı Şapkalı' },
  { id: 7, emoji: '🎧', color: '#00CEC9', name: 'Turkuaz Müzikçi' },
  { id: 8, emoji: '👱‍♀️', color: '#A29BFE', name: 'Lavanta Saçlı' },
];

type Props = NativeStackScreenProps<any, 'AvatarSelection'>;

const AvatarSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatarId || 1);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put('/api/user/me', {
        avatarId: selectedAvatar,
      });
      await refreshProfile();
      Alert.alert('Başarılı', 'Avatarınız güncellendi!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Hata', 'Avatar güncellenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const renderAvatar = ({ item }: { item: typeof AVATARS[0] }) => (
    <TouchableOpacity
      style={[
        styles.avatarItem,
        { backgroundColor: item.color },
        selectedAvatar === item.id && styles.selectedAvatar,
      ]}
      onPress={() => setSelectedAvatar(item.id)}
    >
      <Text style={styles.avatarEmoji}>{item.emoji}</Text>
      {selectedAvatar === item.id && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={FONTS.h2}>Avatar Seç</Text>
        <View style={{ width: 50 }} />
      </View>

      <Text style={styles.subtitle}>
        Profilinde görünecek avatarını seç
      </Text>

      {user?.isPrime && (
        <TouchableOpacity style={styles.primeUploadButton}>
          <Text style={styles.primeUploadText}>
            👑 Galeriden Fotoğraf Yükle (Prime)
          </Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={AVATARS}
        renderItem={renderAvatar}
        keyExtractor={(item) => item.id.toString()}
        numColumns={4}
        contentContainerStyle={styles.avatarGrid}
      />

      <Text style={styles.selectedName}>
        Seçili: {AVATARS.find((a) => a.id === selectedAvatar)?.name}
      </Text>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={FONTS.button}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </Text>
      </TouchableOpacity>

      {!user?.isPrime && (
        <Text style={styles.primeHint}>
          👑 Prime üyeler galeriden gerçek fotoğraf yükleyebilir
        </Text>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  backButton: {
    ...FONTS.body,
    color: COLORS.primary,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  primeUploadButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  primeUploadText: {
    ...FONTS.body,
    color: '#FFD700',
  },
  avatarGrid: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  avatarItem: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    margin: SPACING.sm,
    position: 'relative',
  },
  selectedAvatar: {
    borderWidth: 3,
    borderColor: '#FFD700',
    transform: [{ scale: 1.1 }],
  },
  avatarEmoji: {
    fontSize: 32,
  },
  checkmark: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#FFD700',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedName: {
    ...FONTS.body,
    color: COLORS.text,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: 'auto',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  primeHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});

export default AvatarSelectionScreen;
