import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  NativeModules,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LogoImage = require('../../../assets/logo.png');

// Ülke kodu mapping
const COUNTRY_CODES: { [key: string]: string } = {
  'TR': '+90',
  'US': '+1',
  'GB': '+44',
  'DE': '+49',
  'FR': '+33',
  'IT': '+39',
  'ES': '+34',
  'NL': '+31',
  'BE': '+32',
  'AT': '+43',
  'CH': '+41',
  'SE': '+46',
  'NO': '+47',
  'DK': '+45',
  'FI': '+358',
  'PL': '+48',
  'CZ': '+420',
  'RU': '+7',
  'UA': '+380',
  'GR': '+30',
  'PT': '+351',
  'AZ': '+994',
  'KZ': '+7',
  'GE': '+995',
  'AM': '+374',
};

// Cihazın bölge kodunu al (native modül gerektirmez)
const getDeviceRegion = (): string => {
  try {
    if (Platform.OS === 'ios') {
      const locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
                     NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || 'tr_TR';
      const region = locale.split('_')[1] || locale.split('-')[1] || 'TR';
      return region.toUpperCase();
    } else {
      const locale = NativeModules.I18nManager?.localeIdentifier || 'tr_TR';
      const region = locale.split('_')[1] || 'TR';
      return region.toUpperCase();
    }
  } catch {
    return 'TR';
  }
};

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneVerification'>;

// Resend countdown süresi (saniye)
const RESEND_COOLDOWN = 60;

const PhoneVerificationScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+90');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { loginWithToken } = useAuth();

  const codeInputRef = useRef<TextInput>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Ülke kodunu otomatik algıla (native modül gerektirmez)
  useEffect(() => {
    const region = getDeviceRegion();
    const detectedCode = COUNTRY_CODES[region] || '+90';
    setCountryCode(detectedCode);
    console.log('[PhoneVerification] Detected region:', region, 'Code:', detectedCode);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Code step'e geçince input'a focus
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 100);
    }
  }, [step]);

  const requestOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setErrorMessage('Geçerli bir telefon numarası girin');
      return;
    }
    
    // Telefon numarasını ülke koduyla birleştir (eğer + ile başlamıyorsa)
    const fullPhoneNumber = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `${countryCode}${phoneNumber.replace(/^0+/, '')}`;
    
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await api.post('/api/auth/request-otp', { phoneNumber: fullPhoneNumber });
      
      // Test OTP göster (development veya test mode)
      if (res.data.debugOtp || res.data.testOtp) {
        setDebugOtp(res.data.debugOtp || res.data.testOtp);
      }
      
      setStep('code');
      setResendCooldown(RESEND_COOLDOWN);
    } catch (error: any) {
      let message = 'SMS gönderilemedi. Lütfen tekrar deneyin.';
      
      if (!error.response && error.message === 'Network Error') {
        message = 'İnternet bağlantısı yok. Lütfen bağlantını kontrol et.';
      } else if (error.response?.data?.error?.message) {
        message = error.response.data.error.message;
      }
      
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  // Tam telefon numarasını al
  const getFullPhoneNumber = useCallback(() => {
    return phoneNumber.startsWith('+') 
      ? phoneNumber 
      : `${countryCode}${phoneNumber.replace(/^0+/, '')}`;
  }, [phoneNumber, countryCode]);

  // Telefon numarasını maskele (gizlilik için)
  const getMaskedPhoneNumber = useCallback(() => {
    const full = getFullPhoneNumber();
    if (full.length < 8) return full;
    // +90 541 *** **33 formatı
    const prefix = full.slice(0, 7); // +90 541
    const suffix = full.slice(-2);   // 33
    return `${prefix} *** **${suffix}`;
  }, [getFullPhoneNumber]);

  const verifyOtp = useCallback(async (otpCode: string) => {
    if (otpCode.length !== 6) return;
    if (verifying) return; // Çift tıklama engeli
    
    const fullPhoneNumber = getFullPhoneNumber();
    
    try {
      setVerifying(true);
      setErrorMessage(null);
      Keyboard.dismiss();
      
      const res = await api.post('/api/auth/verify-otp', { phoneNumber: fullPhoneNumber, code: otpCode });
      const { accessToken, refreshToken, user, isProfileComplete } = res.data.data;
      await loginWithToken(accessToken, refreshToken, user);
      
      if (!isProfileComplete) {
        setTimeout(() => {
          navigation.replace('ProfileSetup');
        }, 100);
      }
    } catch (error: any) {
      // Hata türüne göre farklı mesajlar
      const status = error.response?.status;
      const serverMessage = error.response?.data?.error?.message;
      
      let message = 'Bir hata oluştu. Lütfen tekrar deneyin.';
      
      if (status === 400 || serverMessage?.includes('Invalid') || serverMessage?.includes('yanlış')) {
        message = 'Kod hatalı. Lütfen tekrar deneyin.';
        setCode(''); // Input'u temizle
        setTimeout(() => codeInputRef.current?.focus(), 100);
      } else if (status === 410 || serverMessage?.includes('expired') || serverMessage?.includes('süre')) {
        message = 'Kodun süresi doldu. Yeni kod gönder.';
        setCode('');
      } else if (!error.response || error.message?.includes('Network')) {
        message = 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
      }
      
      setErrorMessage(message);
    } finally {
      setVerifying(false);
    }
  }, [getFullPhoneNumber, verifying, loginWithToken, navigation]);

  // Code değiştiğinde otomatik submit
  const handleCodeChange = useCallback((value: string) => {
    // Sadece rakam kabul et
    const numericValue = value.replace(/[^0-9]/g, '');
    setCode(numericValue);
    setErrorMessage(null);
    
    // 6 hane girilince otomatik doğrula
    if (numericValue.length === 6) {
      verifyOtp(numericValue);
    }
  }, [verifyOtp]);

  // ============ PHONE STEP ============
  const renderPhoneStep = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={LogoImage} 
          style={styles.logoSmall}
          resizeMode="contain"
        />
        <Text style={styles.title}>Telefon ile Giriş</Text>
        <Text style={styles.subtitle}>
          Numaranı sadece güvenlik için kullanıyoruz.
        </Text>
        <Text style={styles.trustBadges}>
          Numaran görünmez · Sadece doğrulama
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Phone Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telefon Numarası</Text>
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>{countryCode}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder="5XX XXX XX XX"
              placeholderTextColor={COLORS.textDisabled}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(v) => {
                setPhoneNumber(v);
                setErrorMessage(null);
              }}
              editable={!loading}
              autoFocus
            />
          </View>
          <Text style={styles.inputHint}>
            Ülke kodu otomatik algılandı ({countryCode})
          </Text>
        </View>
        
        {/* Error Message */}
        {errorMessage && step === 'phone' && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.submitButton, styles.accentBtn, !phoneNumber && styles.submitButtonDisabled]}
            onPress={requestOtp}
            disabled={loading || !phoneNumber}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={[styles.submitButtonText, { color: COLORS.background }]}>
                SMS Kodunu Gönder
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.ctaSubtext}>1 dakika sürer</Text>
        </View>

        {/* Trust Message */}
        <View style={styles.trustMessage}>
          <Text style={styles.trustIcon}>🔒</Text>
          <Text style={styles.trustText}>Numaran kimseyle paylaşılmaz</Text>
        </View>
      </View>
    </>
  );

  // ============ CODE STEP ============
  const renderCodeStep = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={LogoImage} 
          style={styles.logoSmall}
          resizeMode="contain"
        />
        <Text style={styles.title}>Kodu Doğrula</Text>
        <Text style={styles.subtitle}>
          {getMaskedPhoneNumber()} numarasına gönderilen 6 haneli kodu gir
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Doğrulama Kodu</Text>
          <TextInput
            ref={codeInputRef}
            style={[
              styles.input, 
              styles.codeInput,
              errorMessage && styles.inputError,
            ]}
            placeholder="• • • • • •"
            placeholderTextColor={COLORS.textDisabled}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={handleCodeChange}
            editable={!verifying}
            textAlign="center"
            autoFocus
            returnKeyType="done"
          />
        </View>
        
        {/* Error Message */}
        {errorMessage && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
        {/* Debug OTP - Test modunda göster */}
        {debugOtp && (
          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>🔧 Test OTP:</Text>
            <Text style={styles.debugCode}>{debugOtp}</Text>
          </View>
        )}
        
        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton, 
              styles.accentBtn, 
              (code.length !== 6 || verifying) && styles.submitButtonDisabled
            ]}
            onPress={() => verifyOtp(code)}
            disabled={verifying || code.length !== 6}
            activeOpacity={0.85}
          >
            {verifying ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={COLORS.background} size="small" />
                <Text style={[styles.submitButtonText, { color: COLORS.background, marginLeft: 8 }]}>
                  Doğrulanıyor...
                </Text>
              </View>
            ) : (
              <Text style={[styles.submitButtonText, { color: COLORS.background }]}>
                Doğrula ve Devam Et
              </Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Resend with Countdown */}
        <TouchableOpacity 
          style={[styles.resendButton, resendCooldown > 0 && styles.resendButtonDisabled]}
          onPress={() => {
            if (resendCooldown === 0) {
              setCode('');
              setErrorMessage(null);
              requestOtp();
            }
          }}
          disabled={loading || resendCooldown > 0}
        >
          <Text style={[
            styles.resendText, 
            resendCooldown > 0 && styles.resendTextDisabled
          ]}>
            {resendCooldown > 0 
              ? `Tekrar gönder (${resendCooldown} sn)` 
              : 'Kodu tekrar gönder'
            }
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const handleBackPress = () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    if (step === 'code') {
      setStep('phone');
      setCode('');
      setDebugOtp(null);
    } else {
      navigation.goBack();
    }
  };

  return (
    <LinearGradient
      colors={COLORS.gradientBackground}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <View 
          style={styles.touchableArea}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => Keyboard.dismiss()}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            
            {/* Back Button */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackPress}
              activeOpacity={0.6}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            
            {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
            
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  touchableArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  
  // Back button - daha görünür
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backButtonText: {
    fontSize: 22,
    color: COLORS.text,
    fontWeight: '600',
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
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
    lineHeight: 22,
    paddingHorizontal: 16,
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
    gap: 16,
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
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    color: COLORS.text,
    fontSize: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 17,
    color: COLORS.text,
    fontWeight: '600',
  },
  phoneInput: {
    flex: 1,
  },
  inputHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginLeft: 4,
    marginTop: 2,
  },
  codeInput: {
    fontSize: 26,
    letterSpacing: 10,
    fontWeight: '700',
  },
  inputError: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  
  // CTA Container
  ctaContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  submitButton: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  accentBtn: {
    backgroundColor: COLORS.accent,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSubtext: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  
  // Error
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Trust Message
  trustMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  trustIcon: {
    fontSize: 14,
  },
  trustText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  
  // Debug
  debugBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  debugLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  debugCode: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 4,
  },
  
  // Resend
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: COLORS.textMuted,
  },
});

export default PhoneVerificationScreen;
