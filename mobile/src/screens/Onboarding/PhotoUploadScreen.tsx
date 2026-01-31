import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhotoUpload'>;

interface LocalPhoto {
  id: string;
  uri: string;
  caption?: string;
}

const PhotoUploadScreen: React.FC<Props> = ({ navigation }) => {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState('');

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (photos.length >= 6) return;
      setPhotos((prev) => [...prev, { id: `${Date.now()}`, uri, caption: '' }]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const openCaptionModal = (photo: LocalPhoto) => {
    setSelectedPhotoId(photo.id);
    setCaptionText(photo.caption || '');
    setCaptionModalVisible(true);
  };

  const saveCaption = () => {
    if (selectedPhotoId) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === selectedPhotoId ? { ...p, caption: captionText.trim() } : p
        )
      );
    }
    setCaptionModalVisible(false);
    setSelectedPhotoId(null);
    setCaptionText('');
  };

  const uploadAll = async () => {
    if (photos.length === 0) {
      // Fotoğraf yoksa direkt devam et
      navigation.replace('BioInput');
      return;
    }
    
    try {
      setUploading(true);
      for (const p of photos) {
        const form = new FormData();
        form.append('photo', {
          // @ts-ignore
          uri: p.uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        });
        // Caption varsa ekle
        if (p.caption) {
          form.append('caption', p.caption);
        }
        await api.post('/api/user/me/photos', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      navigation.replace('BioInput');
    } catch (error) {
      console.error('Photo upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const skipPhotos = () => {
    navigation.replace('BioInput');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>📸</Text>
        <Text style={styles.title}>Fotoğraf Ekle</Text>
        <Text style={styles.subtitle}>
          İstersen fotoğraf ekleyebilirsin, ya da avatarla devam edebilirsin
        </Text>
      </View>

      <View style={styles.photoGrid}>
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const photo = photos[index];
          return (
            <View key={index} style={styles.photoSlotContainer}>
              <TouchableOpacity
                style={styles.photoSlot}
                onPress={photo ? () => removePhoto(photo.id) : pickPhoto}
              >
                {photo ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={styles.photo} />
                    <View style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>✕</Text>
                    </View>
                    {/* Caption indicator */}
                    {photo.caption ? (
                      <View style={styles.captionBadge}>
                        <Ionicons name="chatbubble" size={10} color={COLORS.text} />
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.addSlot}>
                    <Text style={styles.addIcon}>+</Text>
                    {index === 0 && <Text style={styles.addText}>Ekle</Text>}
                  </View>
                )}
              </TouchableOpacity>
              {/* Caption button - sadece fotoğraf varsa */}
              {photo && (
                <TouchableOpacity
                  style={styles.captionButton}
                  onPress={() => openCaptionModal(photo)}
                >
                  <Ionicons 
                    name={photo.caption ? 'create' : 'add-circle-outline'} 
                    size={14} 
                    color={COLORS.accent} 
                  />
                  <Text style={styles.captionButtonText}>
                    {photo.caption ? 'Düzenle' : 'Açıklama'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          Fotoğraf eklemek opsiyoneldir. Anonim kalmak istersen avatarla devam edebilirsin.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          disabled={uploading}
          onPress={uploadAll}
        >
          <Text style={styles.continueButtonText}>
            {uploading ? 'Yükleniyor...' : photos.length > 0 ? 'Devam Et' : 'Fotoğrafsız Devam Et'}
          </Text>
        </TouchableOpacity>

        {photos.length > 0 && (
          <TouchableOpacity style={styles.skipButton} onPress={skipPhotos}>
            <Text style={styles.skipText}>Fotoğrafları Atla</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Caption Modal */}
      <Modal
        visible={captionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCaptionModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fotoğraf Açıklaması</Text>
              <TouchableOpacity onPress={() => setCaptionModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalHint}>
              Fotoğrafın hakkında kısa bir açıklama yaz (opsiyonel)
            </Text>
            
            <TextInput
              style={styles.captionInput}
              value={captionText}
              onChangeText={(text) => text.length <= 80 && setCaptionText(text)}
              placeholder="Örn: Tatilde çekildi 🌴"
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={80}
              autoFocus
            />
            
            <Text style={styles.charCount}>
              {captionText.length}/80
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setCaptionModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveCaption}
              >
                <Text style={styles.modalSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    marginBottom: SPACING.xl,
  },
  emoji: {
    fontSize: 50,
    marginBottom: SPACING.sm,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  photoSlotContainer: {
    alignItems: 'center',
  },
  photoSlot: {
    width: 100,
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  captionBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 2,
  },
  captionButtonText: {
    fontSize: 11,
    color: COLORS.accent,
  },
  addSlot: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: 30,
    color: COLORS.textMuted,
  },
  addText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  infoText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    flex: 1,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: SPACING.lg,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  continueButtonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 16,
  },
  skipButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  skipText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  modalHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  captionInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  charCount: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalCancelText: {
    ...FONTS.button,
    color: COLORS.textMuted,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalSaveText: {
    ...FONTS.button,
    color: COLORS.text,
  },
});

export default PhotoUploadScreen;
