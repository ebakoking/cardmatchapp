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
  ScrollView,
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
        form.append('type', 'CORE');
        if (p.caption) {
          form.append('caption', p.caption);
        }
        console.log('[PhotoUpload] Uploading photo with type: CORE');
        await api.post('/api/user/me/photos', form, {
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

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header - Minimal */}
        <View style={styles.header}>
          <Text style={styles.title}>Fotoğraf Ekle</Text>
          <Text style={styles.subtitle}>
            Fotoğraflar yalnızca sen izin verdiğinde görünür.
          </Text>
        </View>

        {/* Photo Grid - Premium feel */}
        <View style={styles.photoGrid}>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const photo = photos[index];
            const isPrimary = index === 0;
            
            return (
              <View key={index} style={styles.photoSlotContainer}>
                <TouchableOpacity
                  style={[
                    styles.photoSlot,
                    isPrimary && !photo && styles.primarySlot,
                    !isPrimary && !photo && styles.secondarySlot,
                  ]}
                  onPress={photo ? () => removePhoto(photo.id) : pickPhoto}
                  activeOpacity={0.7}
                >
                  {photo ? (
                    <>
                      <Image source={{ uri: photo.uri }} style={styles.photo} />
                      <View style={styles.removeButton}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </View>
                      {photo.caption ? (
                        <View style={styles.captionBadge}>
                          <Ionicons name="chatbubble" size={10} color={COLORS.text} />
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.addSlotContent}>
                      {isPrimary ? (
                        <>
                          <View style={styles.primaryAddIcon}>
                            <Ionicons name="add" size={28} color={COLORS.accent} />
                          </View>
                          <Text style={styles.primaryAddText}>Fotoğraf Ekle</Text>
                        </>
                      ) : (
                        <Ionicons name="add" size={24} color={COLORS.textMuted} style={{ opacity: 0.5 }} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Caption button */}
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
      </ScrollView>

      {/* Footer - Fixed at bottom */}
      <View style={styles.footer}>
        {/* Confidence microcopy */}
        <Text style={styles.confidenceText}>
          Profilinden dilediğin zaman fotoğraf ekleyebilirsin.
        </Text>

        {/* Primary CTA - Always active */}
        <TouchableOpacity
          style={[styles.continueButton, uploading && styles.continueButtonDisabled]}
          disabled={uploading}
          onPress={uploadAll}
        >
          <Text style={styles.continueButtonText}>
            {uploading ? 'Yükleniyor...' : 'Devam Et'}
          </Text>
        </TouchableOpacity>

        {/* Secondary link - Skip option */}
        {photos.length === 0 && (
          <TouchableOpacity style={styles.skipLink} onPress={skipPhotos}>
            <Text style={styles.skipLinkText}>Şimdilik fotoğrafsız devam et</Text>
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
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: SPACING.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.lg,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  // Photo Grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  photoSlotContainer: {
    alignItems: 'center',
  },
  photoSlot: {
    width: 100,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
  },
  // Primary slot - First slot with emphasis
  primarySlot: {
    backgroundColor: 'rgba(0, 206, 201, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 206, 201, 0.3)',
    borderStyle: 'solid',
  },
  // Secondary slots - Subtle placeholders
  secondarySlot: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'solid',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
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
    marginTop: 6,
    gap: 3,
  },
  captionButtonText: {
    fontSize: 11,
    color: COLORS.accent,
  },
  addSlotContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  primaryAddIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 206, 201, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryAddText: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '500',
  },
  // Footer
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
  },
  confidenceText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontSize: 13,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 16,
  },
  skipLink: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipLinkText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
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
