import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<ProfileStackParamList, 'VerificationSelfie'>;

// Poz tipleri ve açıklamaları
type VerificationPose = 'THUMBS_UP' | 'PEACE_SIGN' | 'WAVE_HAND' | 'POINT_UP' | 'OK_SIGN';

const POSE_INFO: Record<VerificationPose, { emoji: string; title: string; description: string }> = {
  THUMBS_UP: {
    emoji: '👍',
    title: 'Başparmak Yukarı',
    description: 'Başparmağınızı yukarı kaldırarak selfie çekin',
  },
  PEACE_SIGN: {
    emoji: '✌️',
    title: 'V İşareti',
    description: 'V işareti yaparak selfie çekin',
  },
  WAVE_HAND: {
    emoji: '👋',
    title: 'El Sallayın',
    description: 'El sallayarak selfie çekin',
  },
  POINT_UP: {
    emoji: '☝️',
    title: 'Yukarı İşaret',
    description: 'Yukarı işaret ederek selfie çekin',
  },
  OK_SIGN: {
    emoji: '👌',
    title: 'OK İşareti',
    description: 'OK işareti yaparak selfie çekin',
  },
};

const VerificationSelfieScreen: React.FC<Props> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [pose, setPose] = useState<VerificationPose | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  // Doğrulama durumunu kontrol et
  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const res = await api.get('/api/verification/status');
      if (res.data.success) {
        const { verified, verificationStatus, latestRequest } = res.data.data;
        
        if (verified) {
          setStatus('approved');
        } else if (verificationStatus === 'PENDING') {
          setStatus('pending');
        } else if (verificationStatus === 'REJECTED') {
          setStatus('rejected');
        } else {
          // Doğrulama başlat - rastgele poz al
          await startVerification();
        }
      }
    } catch (error) {
      console.error('Verification status error:', error);
    } finally {
      setLoading(false);
    }
  };

  const startVerification = async () => {
    try {
      const res = await api.post('/api/verification/start');
      if (res.data.success) {
        setPose(res.data.data.pose as VerificationPose);
      }
    } catch (error) {
      console.error('Start verification error:', error);
      Alert.alert('Hata', 'Doğrulama başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
      }
    } catch (error) {
      console.error('Take picture error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilemedi. Lütfen tekrar deneyin.');
    }
  };

  const retakePicture = () => {
    setCapturedPhoto(null);
  };

  const submitPhoto = async () => {
    if (!capturedPhoto || !pose) return;

    try {
      setUploading(true);

      // Önce fotoğrafı yükle
      const form = new FormData();
      form.append('photo', {
        // @ts-ignore
        uri: capturedPhoto,
        name: 'verification_selfie.jpg',
        type: 'image/jpeg',
      });

      const uploadRes = await api.post('/api/upload/photo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!uploadRes.data.success || !uploadRes.data.url) {
        throw new Error('Fotoğraf yüklenemedi');
      }

      // Doğrulama isteği gönder
      const verifyRes = await api.post('/api/verification/submit', {
        pose: pose,
        selfieUrl: uploadRes.data.url,
      });

      if (verifyRes.data.success) {
        setStatus('pending');
        Alert.alert(
          'Başarılı!',
          'Doğrulama isteğiniz alındı. Moderatör incelemesinden sonra bilgilendirileceksiniz.',
          [{ text: 'Tamam', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error: any) {
      console.error('Submit verification error:', error);
      const message = error.response?.data?.error?.message || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      Alert.alert('Hata', message);
    } finally {
      setUploading(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  // Zaten doğrulanmış
  if (status === 'approved') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
          </View>
          <Text style={styles.statusTitle}>Profiliniz Doğrulandı!</Text>
          <Text style={styles.statusSubtitle}>
            Doğrulanmış profil rozetiniz aktif durumda.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Beklemede
  if (status === 'pending') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <View style={styles.pendingIcon}>
            <Ionicons name="time" size={80} color={COLORS.warning} />
          </View>
          <Text style={styles.statusTitle}>İnceleniyor</Text>
          <Text style={styles.statusSubtitle}>
            Doğrulama isteğiniz moderatör tarafından inceleniyor.{'\n'}
            Sonuç için bildirim alacaksınız.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // İzin gerekiyorsa
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <Ionicons name="camera-outline" size={60} color={COLORS.textMuted} />
          <Text style={styles.statusTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.statusSubtitle}>
            Doğrulama selfie'si için kamera erişimi gereklidir.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>İzin Ver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
            <Text style={styles.skipText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Poz yoksa
  if (!pose) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>Bir Hata Oluştu</Text>
          <Text style={styles.statusSubtitle}>
            Doğrulama başlatılamadı. Lütfen tekrar deneyin.
          </Text>
          <TouchableOpacity style={styles.button} onPress={startVerification}>
            <Text style={styles.buttonText}>Tekrar Dene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => navigation.goBack()}>
            <Text style={styles.skipText}>Vazgeç</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const poseInfo = POSE_INFO[pose];

  // Fotoğraf çekildi - önizleme
  if (capturedPhoto) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fotoğrafı Onayla</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
        </View>

        <View style={styles.poseReminder}>
          <Text style={styles.poseEmoji}>{poseInfo.emoji}</Text>
          <Text style={styles.poseTitle}>{poseInfo.title}</Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.retakeButton]}
            onPress={retakePicture}
            disabled={uploading}
          >
            <Ionicons name="refresh" size={24} color={COLORS.text} />
            <Text style={styles.actionButtonText}>Tekrar Çek</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.confirmButton]}
            onPress={submitPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="checkmark" size={24} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Gönder</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Kamera ekranı
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil Doğrulama</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Poz talimatı */}
      <View style={styles.poseInstruction}>
        <Text style={styles.poseEmoji}>{poseInfo.emoji}</Text>
        <Text style={styles.poseTitle}>{poseInfo.title}</Text>
        <Text style={styles.poseDescription}>{poseInfo.description}</Text>
      </View>

      {/* Kamera */}
      <View style={styles.cameraWrapper}>
        <CameraView style={styles.camera} facing="front" ref={cameraRef} />
        <View style={styles.cameraOverlay}>
          <View style={styles.faceGuide} />
        </View>
      </View>

      {/* Çek butonu */}
      <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
        <View style={styles.captureButtonInner} />
      </TouchableOpacity>

      <Text style={styles.hint}>
        Yüzünüzün net göründüğünden ve{'\n'}istenen pozu yaptığınızdan emin olun
      </Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  loadingText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  successIcon: {
    marginBottom: SPACING.lg,
  },
  pendingIcon: {
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
  },
  statusSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  poseInstruction: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  poseEmoji: {
    fontSize: 48,
    marginBottom: SPACING.xs,
  },
  poseTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  poseDescription: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  cameraWrapper: {
    flex: 1,
    marginHorizontal: SPACING.lg,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: 200,
    height: 260,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 120,
  },
  captureButton: {
    alignSelf: 'center',
    marginVertical: SPACING.lg,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.text,
  },
  hint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  poseReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginVertical: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  retakeButton: {
    backgroundColor: COLORS.surface,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  actionButtonText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  skipButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
  },
  skipText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
});

export default VerificationSelfieScreen;
