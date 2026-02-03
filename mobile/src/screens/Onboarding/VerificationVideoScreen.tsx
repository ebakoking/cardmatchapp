import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerificationVideo'>;

const VerificationVideoScreen: React.FC<Props> = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startRecording = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    if (!cameraRef.current) return;

    try {
      setRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 5,
      });
      setRecording(false);

      if (!video) return;

      setUploading(true);
      const form = new FormData();
      form.append('video', {
        // @ts-ignore
        uri: video.uri,
        name: 'verification.mp4',
        type: 'video/mp4',
      });
      await api.post('/api/user/me/verification-video', form, {
      });
      setUploading(false);
      navigation.replace('Tutorial');
    } catch (error) {
      console.error('Recording error:', error);
      setRecording(false);
      setUploading(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && recording) {
      cameraRef.current.stopRecording();
    }
  };

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
        <Text style={styles.title}>Kamera İzni Gerekli</Text>
        <Text style={styles.subtitle}>
          Doğrulama videosu için kamera erişimi gereklidir.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={FONTS.button}>İzin Ver</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.skipButton} 
          onPress={() => navigation.replace('Tutorial')}
        >
          <Text style={styles.skipText}>Şimdilik Geç</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Doğrulama Videosu</Text>
      <Text style={styles.subtitle}>
        Yüzünüzü gösterin ve başınızı sağa-sola çevirin. 5 saniyelik kısa bir video
        kaydedeceğiz.
      </Text>

      <View style={styles.cameraWrapper}>
        <CameraView 
          style={styles.camera} 
          facing="front" 
          ref={cameraRef}
          mode="video"
        />
      </View>

      <TouchableOpacity
        style={[styles.button, recording && styles.recordingButton]}
        onPress={recording ? stopRecording : startRecording}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={FONTS.button}>
            {recording ? '⏹ Kaydı Durdur' : '🔴 Kaydı Başlat'}
          </Text>
        )}
      </TouchableOpacity>

      {uploading && (
        <Text style={styles.uploadingText}>
          Videonuz inceleniyor...
        </Text>
      )}

      <TouchableOpacity 
        style={styles.skipButton} 
        onPress={() => navigation.replace('Tutorial')}
      >
        <Text style={styles.skipText}>Şimdilik Geç</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  cameraWrapper: {
    marginTop: SPACING.xl,
    borderRadius: 16,
    overflow: 'hidden',
    height: 300,
    backgroundColor: COLORS.surface,
  },
  camera: {
    flex: 1,
  },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: COLORS.danger,
  },
  uploadingText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
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

export default VerificationVideoScreen;
