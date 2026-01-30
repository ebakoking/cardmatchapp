import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../theme/colors';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LogoImage = require('../../../assets/logo.png');

type AuthStackParamList = {
  Landing: undefined;
  EmailAuth: undefined;
  ProfileSetup: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailAuth'>;
type AuthMode = 'login' | 'register';

const EmailAuthScreen: React.FC<Props> = ({ navigation }) => {
  const { loginWithToken } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Validation
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = mode === 'login' || password === confirmPassword;
  const isFormValid = isEmailValid && isPasswordValid && isConfirmPasswordValid;

  const handleLogin = async () => {
    if (!isFormValid) {
      Alert.alert('Hata', 'Lütfen geçerli bir e-posta ve şifre girin.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/email/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data.success) {
        const { accessToken, refreshToken, user, isProfileComplete } = response.data.data;
        await loginWithToken(accessToken, refreshToken, user);
        
        if (!isProfileComplete) {
          navigation.navigate('ProfileSetup');
        }
      }
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Giriş yapılamadı.';
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!isFormValid) {
      if (!isEmailValid) {
        Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
        return;
      }
      if (!isPasswordValid) {
        Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (!isConfirmPasswordValid) {
        Alert.alert('Hata', 'Şifreler eşleşmiyor.');
        return;
      }
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/api/auth/email/register', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data.success) {
        const { accessToken, refreshToken, user } = response.data.data;
        await loginWithToken(accessToken, refreshToken, user);
        navigation.navigate('ProfileSetup');
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode === 'EMAIL_EXISTS') {
        Alert.alert('Hata', 'Bu e-posta adresi zaten kayıtlı.');
        setMode('login');
      } else {
        const message = error.response?.data?.error?.message || 'Kayıt olunamadı.';
        Alert.alert('Hata', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'login') {
      handleLogin();
    } else {
      handleRegister();
    }
  };

  return (
    <LinearGradient
      colors={COLORS.gradientBackground}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeAnim }}>
              
              {/* Back Button - subtle */}
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              
              {/* Header */}
              <View style={styles.header}>
                <Image 
                  source={LogoImage} 
                  style={styles.logoSmall}
                  resizeMode="contain"
                />
                <Text style={styles.title}>
                  {mode === 'login' ? 'Tekrar Hoşgeldin' : 'Hesap Oluştur'}
                </Text>
                <Text style={styles.subtitle}>
                  {mode === 'login' 
                    ? 'E-posta ile güvenli giriş yap.'
                    : 'Hemen kayıt ol, 1 dakika içinde başla.'
                  }
                </Text>
                <Text style={styles.trustBadges}>
                  Şifreli bağlantı · Veriler güvende · Spam yok
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                
                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>E-posta</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        email.length > 0 && !isEmailValid && styles.inputError,
                      ]}
                      placeholder="ornek@email.com"
                      placeholderTextColor={COLORS.textDisabled}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      autoFocus
                    />
                    {email.length > 0 && isEmailValid && (
                      <Text style={styles.inputCheck}>✓</Text>
                    )}
                  </View>
                  {email.length > 0 && !isEmailValid && (
                    <Text style={styles.errorText}>Geçerli bir e-posta girin</Text>
                  )}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Şifre</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.passwordInput,
                        password.length > 0 && !isPasswordValid && styles.inputError,
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.textDisabled}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      style={styles.showPasswordBtn}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.showPasswordIcon}>
                        {showPassword ? '🙈' : '👁'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {password.length > 0 && !isPasswordValid && (
                    <Text style={styles.errorText}>En az 6 karakter gerekli</Text>
                  )}
                </View>

                {/* Confirm Password */}
                {mode === 'register' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Şifre Tekrar</Text>
                    <TextInput
                      style={[
                        styles.input,
                        confirmPassword.length > 0 && !isConfirmPasswordValid && styles.inputError,
                      ]}
                      placeholder="••••••••"
                      placeholderTextColor={COLORS.textDisabled}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                    />
                    {confirmPassword.length > 0 && !isConfirmPasswordValid && (
                      <Text style={styles.errorText}>Şifreler eşleşmiyor</Text>
                    )}
                  </View>
                )}

                {/* CTA */}
                <View style={styles.ctaContainer}>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      !isFormValid && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || !isFormValid}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.background} />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol ve Başla'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {mode === 'register' && (
                    <Text style={styles.ctaSubtext}>1 dakika sürer</Text>
                  )}
                </View>

                {/* Trust Message */}
                <View style={styles.trustMessage}>
                  <Text style={styles.trustIcon}>🔒</Text>
                  <Text style={styles.trustText}>Bilgilerin şifreli olarak saklanır</Text>
                </View>

                {/* Mode Toggle */}
                <View style={styles.modeToggle}>
                  <Text style={styles.modeToggleText}>
                    {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
                    disabled={loading}
                  >
                    <Text style={styles.modeToggleLink}>
                      {mode === 'login' ? 'Kayıt Ol' : 'Giriş Yap'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  
  // Back - subtle
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 20,
    color: COLORS.textMuted,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoSmall: {
    width: 56,
    height: 56,
    borderRadius: 14,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  trustBadges: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    letterSpacing: 0.3,
  },

  // Form
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  passwordInput: {
    paddingRight: 50,
  },
  inputCheck: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -10 }],
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  showPasswordBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  showPasswordIcon: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginLeft: 4,
  },
  
  // CTA
  ctaContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  submitButton: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.background,
  },
  ctaSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  
  // Trust Message
  trustMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  
  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  modeToggleText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
  modeToggleLink: {
    fontSize: 15,
    color: COLORS.accent,
    fontWeight: '600',
  },
});

export default EmailAuthScreen;
