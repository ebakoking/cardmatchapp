import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhotoUpload'>;

interface LocalPhoto {
  id: string;
  uri: string;
}

const PhotoUploadScreen: React.FC<Props> = ({ navigation }) => {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (photos.length >= 6) return;
      setPhotos((prev) => [...prev, { id: `${Date.now()}`, uri }]);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
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
            <TouchableOpacity
              key={index}
              style={styles.photoSlot}
              onPress={photo ? () => removePhoto(photo.id) : pickPhoto}
            >
              {photo ? (
                <>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <View style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>✕</Text>
                  </View>
                </>
              ) : (
                <View style={styles.addSlot}>
                  <Text style={styles.addIcon}>+</Text>
                  {index === 0 && <Text style={styles.addText}>Ekle</Text>}
                </View>
              )}
            </TouchableOpacity>
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
});

export default PhotoUploadScreen;
