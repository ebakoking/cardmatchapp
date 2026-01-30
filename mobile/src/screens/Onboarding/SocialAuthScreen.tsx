import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<any, 'SocialAuth'>;

const SocialAuthScreen: React.FC<Props> = ({ navigation }) => {
  const { loginWithToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Mock Google Auth (gerçek uygulamada Google Cloud Console'dan client ID alınmalı)
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setLoadingProvider('google');

      // DEV MODE: Mock Google login
      // Gerçek uygulamada expo-auth-session kullanılacak
      Alert.alert(
        'Google ile Giriş',
        'Google OAuth entegrasyonu için Google Cloud Console\'dan Client ID gerekli.\n\nŞimdilik Telefon ile Giriş Yap seçeneğini kullanabilirsin.',
        [
          { text: 'Telefon ile Giriş', onPress: handlePhoneAuth },
          { text: 'Tamam', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Hata', 'Google ile giriş yapılamadı.');
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handleAppleAuth = async () => {
    try {
      setLoading(true);
      setLoadingProvider('apple');

      // Apple Authentication kontrolü
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Hata', 'Apple ile giriş bu cihazda desteklenmiyor.');
        return;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple credential:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
      });

      // Backend'e gönder
      const response = await api.post('/api/auth/social', {
        provider: 'apple',
        idToken: credential.identityToken || credential.user,
        appleUserId: credential.user,
        email: credential.email || undefined,
        name: credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : undefined,
      });

      if (response.data.success) {
        await AsyncStorage.setItem('token', response.data.data.token);
        // AuthContext'e token ve user'ı kaydet
        await loginWithToken(response.data.data.token, response.data.data.user);
        
        // Yeni kullanıcı ise profil kurulumuna yönlendir
        if (response.data.data.isNewUser) {
          navigation.replace('ProfileSetup');
        }
        // Mevcut kullanıcı - isOnboarded kontrolü otomatik MainTabs'a yönlendirir
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // Kullanıcı iptal etti
        console.log('Apple auth cancelled');
        return;
      }
      console.error('Apple auth error:', error);
      Alert.alert('Hata', 'Apple ile giriş yapılamadı. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
      setLoadingProvider(null);
    }
  };

  const handlePhoneAuth = () => {
    navigation.navigate('PhoneVerification');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>C</Text>
          <Text style={styles.logoAmpersand}>&</Text>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.title}>CardMatch</Text>
        <Text style={styles.subtitle}>
          Verified-only dating. Chat first, reveal later.
        </Text>
      </View>

      <View style={styles.authButtons}>
        {/* Apple Sign In - Sadece iOS'ta göster */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.authButton, styles.appleButton]}
            onPress={handleAppleAuth}
            disabled={loading}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.appleIcon}></Text>
                <Text style={[styles.authButtonText, styles.appleButtonText]}>
                  Apple ile Giriş Yap
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.authButton, styles.googleButton]}
          onPress={handleGoogleAuth}
          disabled={loading}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.authButtonText}>Google ile Giriş Yap</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>veya</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Phone Auth */}
        <TouchableOpacity
          style={[styles.authButton, styles.phoneButton]}
          onPress={handlePhoneAuth}
          disabled={loading}
        >
          <Text style={styles.phoneIcon}>📱</Text>
          <Text style={styles.authButtonText}>Telefon ile Giriş Yap</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.termsText}>
        Devam ederek Kullanım Koşullarını ve Gizlilik Politikasını kabul
        etmiş olursunuz.
      </Text>
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
    marginTop: SPACING.xl * 2,
    marginBottom: SPACING.xl * 2,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: SPACING.md,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  logoAmpersand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 2,
    opacity: 0.9,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  authButtons: {
    flex: 1,
    justifyContent: 'center',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 4,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  appleButtonText: {
    color: '#000000',
  },
  appleIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: SPACING.sm,
  },
  phoneButton: {
    backgroundColor: COLORS.primary,
  },
  phoneIcon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  authButtonText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginHorizontal: SPACING.md,
  },
  termsText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
});

export default SocialAuthScreen;
