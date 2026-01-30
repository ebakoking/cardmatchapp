import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  ScrollView,
  Animated,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import * as Location from 'expo-location';
import { getZodiacSign, getZodiacMessage, ZodiacSign } from '../../utils/zodiac';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const TOTAL_STEPS = 3;

const ProfileSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { refreshProfile, logout } = useAuth();
  
  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form data
  const [nickname, setNickname] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | null>(null);
  
  // Location state (arka planda)
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('TR');
  const [locationGranted, setLocationGranted] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');

  // Birth date input refs (auto-focus için)
  const dayInputRef = useRef<TextInput>(null);
  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);
  
  // Focus tracking (görsel vurgulama için)
  const [focusedInput, setFocusedInput] = useState<'day' | 'month' | 'year' | null>(null);
  
  // Zodiac kartı animasyonu
  const zodiacAnimValue = useRef(new Animated.Value(0)).current;

  // Konum izni al (arka planda, sayfa açılınca)
  const requestLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setShowLocationModal(true);
        return false;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);

      // Reverse geocoding
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        
        if (address) {
          setCity(address.city || address.subregion || address.region || '');
          setCountry(address.isoCountryCode || 'TR');
        }
      } catch (e) {
        console.log('Reverse geocoding failed:', e);
      }
      
      setLocationGranted(true);
      setShowLocationModal(false);
      return true;
    } catch (error) {
      console.error('Location error:', error);
      setShowLocationModal(true);
      return false;
    }
  }, []);

  // Sayfa açıldığında konum iste
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Doğum tarihi değiştiğinde yaş ve burç hesapla
  useEffect(() => {
    const day = parseInt(birthDay);
    const month = parseInt(birthMonth);
    const year = parseInt(birthYear);

    if (birthYear.length === 4 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      // Yaş hesapla
      const birthDate = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setCalculatedAge(age > 0 ? age : null);

      // Burç hesapla
      const sign = getZodiacSign(day, month);
      if (sign && !zodiacSign) {
        // Yeni burç gösterilirken animasyon başlat
        zodiacAnimValue.setValue(0);
        Animated.spring(zodiacAnimValue, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }
      setZodiacSign(sign);
    } else {
      setCalculatedAge(null);
      setZodiacSign(null);
      zodiacAnimValue.setValue(0);
    }
  }, [birthYear, birthMonth, birthDay, zodiacSign, zodiacAnimValue]);

  // Nickname kontrolü (debounce)
  useEffect(() => {
    console.log('[ProfileSetup] Nickname changed:', nickname, 'length:', nickname.length);
    
    if (nickname.length < 3) {
      setNicknameStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        console.log('[ProfileSetup] Checking nickname:', nickname);
        setNicknameStatus('checking');
        const res = await api.get('/api/user/check-nickname', {
          params: { nickname },
        });
        console.log('[ProfileSetup] Nickname check response:', res.data);
        setNicknameStatus(res.data.available ? 'available' : 'taken');
      } catch (error: any) {
        // API hatası durumunda kullanılabilir kabul et (yeni kullanıcı için)
        console.log('[ProfileSetup] Nickname check failed:', error?.response?.status, error?.message);
        setNicknameStatus('available');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [nickname]);

  // Sonraki adıma geç
  const nextStep = () => {
    dismissKeyboard();
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      saveProfile();
    }
  };

  // Önceki adıma dön
  const prevStep = () => {
    dismissKeyboard();
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Klavyeyi kapat
  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // Çıkış yap (Landing ekranına dön)
  const handleLogout = () => {
    dismissKeyboard();
    Alert.alert(
      'Çıkış Yap',
      'Emin misin? Giriş ekranına döneceksin.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkış Yap', 
          style: 'destructive',
          onPress: async () => {
            // Önce logout yap
            await logout();
            // Sonra navigation stack'i sıfırla
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Landing' }],
              })
            );
          },
        },
      ]
    );
  };

  // Her adımın geçerliliğini kontrol et
  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        const step1Valid = nickname.length >= 3 && nicknameStatus === 'available';
        console.log('[ProfileSetup] Step 1 validation:', { nickname, nicknameStatus, valid: step1Valid });
        return step1Valid;
      case 2:
        return calculatedAge !== null && calculatedAge >= 18 && zodiacSign !== null;
      case 3:
        return gender !== null;
      default:
        return false;
    }
  };

  // Profili kaydet
  const saveProfile = async () => {
    // Konum kontrolü
    if (!locationGranted) {
      const granted = await requestLocation();
      if (!granted) {
        return;
      }
    }

    if (!calculatedAge || calculatedAge < 18) {
      Alert.alert('Yaş Sınırı', 'CardMatch\'i kullanmak için 18 yaşından büyük olmalısın.');
      return;
    }

    try {
      setLoading(true);
      
      // Doğum tarihini oluştur
      const birthDate = new Date(
        parseInt(birthYear), 
        parseInt(birthMonth) - 1, 
        parseInt(birthDay)
      ).toISOString();

      const payload = {
        nickname,
        age: calculatedAge,
        birthDate,
        gender,
        interestedIn: 'BOTH',
        city: city || 'Bilinmiyor',
        country: country || 'TR',
        latitude: latitude || 41.0082, // İstanbul varsayılan
        longitude: longitude || 28.9784,
      };

      console.log('Saving profile with:', payload);

      await api.put('/api/user/me', payload);
      // ÖNEMLİ: refreshProfile() ÇAĞIRMA! 
      // Çağırırsak RootNavigator yeniden render olur ve PhotoUpload'a gitmeden MainTabs'e atlayabilir.
      // Profil, onboarding tamamen bitince TutorialScreen'de güncellenecek.
      navigation.replace('PhotoUpload');
    } catch (error: any) {
      console.error('Profile save error:', error?.response?.data || error);
      Alert.alert(
        'Hata', 
        error?.response?.data?.error || 'Profil kaydedilirken bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Progress bar
  const renderProgress = () => (
    <View style={styles.progressContainer}>
      {[1, 2, 3].map((step) => (
        <View
          key={step}
          style={[
            styles.progressDot,
            currentStep >= step && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  // Adım 1: Kullanıcı Adı
  const renderStep1 = () => {
    // Nickname validasyonu (boşluk ve karakter limiti)
    const handleNicknameChange = (text: string) => {
      // Boşluk ve özel karakterleri kaldır, max 15 karakter
      const cleaned = text.replace(/\s/g, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
      setNickname(cleaned);
    };

    return (
      <ScrollView 
        style={styles.stepScrollView}
        contentContainerStyle={styles.stepScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View 
          style={styles.dismissArea}
          onStartShouldSetResponder={() => true}
          onResponderRelease={dismissKeyboard}
        >
          <Text style={styles.stepEmoji}>👤</Text>
          <Text style={styles.stepTitle}>Sohbette hangi isimle görünmek istersin?</Text>
          <Text style={styles.stepSubtitle}>
            Gerçek adın olmak zorunda değil.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                nicknameStatus === 'taken' && styles.inputError,
                nicknameStatus === 'available' && styles.inputSuccess,
              ]}
              value={nickname}
              onChangeText={handleNicknameChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={dismissKeyboard}
              maxLength={15}
            />
            
            {nicknameStatus === 'checking' && (
              <ActivityIndicator 
                style={styles.inputIcon} 
                size="small" 
                color={COLORS.primary} 
              />
            )}
            {nicknameStatus === 'available' && (
              <Text style={styles.inputIconSuccess}>✓</Text>
            )}
            {nicknameStatus === 'taken' && (
              <Text style={styles.inputIconError}>✗</Text>
            )}
          </View>

          {/* Input kuralları - sadece gerekli olanlar */}
          <Text style={styles.inputRules}>
            3–15 karakter · Boşluk yok
          </Text>

          {/* Durum mesajları */}
          {nicknameStatus === 'taken' && (
            <Text style={styles.errorText}>
              Bu isim alınmış, başka bir tane dene.
            </Text>
          )}
          {nicknameStatus === 'available' && nickname.length >= 3 && (
            <Text style={styles.successText}>
              ✓ Kullanılabilir
            </Text>
          )}
          {nickname.length > 0 && nickname.length < 3 && (
            <Text style={styles.hintText}>
              En az 3 karakter olmalı
            </Text>
          )}
        </View>
      </ScrollView>
    );
  };

  // Adım 2: Doğum Tarihi + Burç
  const renderStep2 = () => {
    // Gün input handler - 2 karakter girilince Ay'a geç
    const handleDayChange = (v: string) => {
      const cleaned = v.replace(/[^0-9]/g, '').slice(0, 2);
      setBirthDay(cleaned);
      if (cleaned.length === 2) {
        monthInputRef.current?.focus();
      }
    };

    // Ay input handler - 2 karakter girilince Yıl'a geç
    const handleMonthChange = (v: string) => {
      const cleaned = v.replace(/[^0-9]/g, '').slice(0, 2);
      setBirthMonth(cleaned);
      if (cleaned.length === 2) {
        yearInputRef.current?.focus();
      }
    };

    // Yıl input handler - 4 karakter girilince klavyeyi kapat
    const handleYearChange = (v: string) => {
      const cleaned = v.replace(/[^0-9]/g, '').slice(0, 4);
      setBirthYear(cleaned);
      if (cleaned.length === 4) {
        setTimeout(dismissKeyboard, 100);
      }
    };

    // Backspace handler - boş ise önceki input'a geç
    const handleKeyPress = (
      e: NativeSyntheticEvent<TextInputKeyPressEventData>,
      currentValue: string,
      prevRef: React.RefObject<TextInput> | null
    ) => {
      if (e.nativeEvent.key === 'Backspace' && currentValue === '' && prevRef) {
        prevRef.current?.focus();
      }
    };

    return (
      <ScrollView 
        style={styles.stepScrollView} 
        contentContainerStyle={styles.stepScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View 
          style={styles.dismissArea}
          onStartShouldSetResponder={() => true}
          onResponderRelease={dismissKeyboard}
        >
          <Text style={styles.stepEmoji}>🎂</Text>
          <Text style={styles.stepTitle}>Doğum Tarihin</Text>
          <Text style={styles.stepSubtitle}>
            Daha uyumlu eşleşmeler için yaşını hesaplıyoruz.
          </Text>

          <View style={styles.birthDateRow}>
            {/* Gün Input */}
            <View style={styles.birthInputContainer}>
              <Text style={[
                styles.birthLabel,
                focusedInput === 'day' && styles.birthLabelActive,
              ]}>Gün</Text>
              <TextInput
                ref={dayInputRef}
                style={[
                  styles.birthInput,
                  focusedInput === 'day' && styles.birthInputActive,
                ]}
                value={birthDay}
                onChangeText={handleDayChange}
                onFocus={() => setFocusedInput('day')}
                onBlur={() => setFocusedInput(null)}
                placeholder="08"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                textAlign="center"
              />
            </View>

            {/* Ay Input */}
            <View style={styles.birthInputContainer}>
              <Text style={[
                styles.birthLabel,
                focusedInput === 'month' && styles.birthLabelActive,
              ]}>Ay</Text>
              <TextInput
                ref={monthInputRef}
                style={[
                  styles.birthInput,
                  focusedInput === 'month' && styles.birthInputActive,
                ]}
                value={birthMonth}
                onChangeText={handleMonthChange}
                onFocus={() => setFocusedInput('month')}
                onBlur={() => setFocusedInput(null)}
                onKeyPress={(e) => handleKeyPress(e, birthMonth, dayInputRef)}
                placeholder="05"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                textAlign="center"
              />
            </View>

            {/* Yıl Input */}
            <View style={styles.birthInputContainer}>
              <Text style={[
                styles.birthLabel,
                focusedInput === 'year' && styles.birthLabelActive,
              ]}>Yıl</Text>
              <TextInput
                ref={yearInputRef}
                style={[
                  styles.birthInput,
                  styles.birthInputYear,
                  focusedInput === 'year' && styles.birthInputActive,
                ]}
                value={birthYear}
                onChangeText={handleYearChange}
                onFocus={() => setFocusedInput('year')}
                onBlur={() => setFocusedInput(null)}
                onKeyPress={(e) => handleKeyPress(e, birthYear, monthInputRef)}
                placeholder="1995"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                textAlign="center"
              />
            </View>
          </View>

          {/* Güven microcopy */}
          <Text style={styles.birthTrustText}>
            Yaş uyumu için kullanılır
          </Text>

          {/* Burç Gösterimi - Animasyonlu */}
          {zodiacSign && (
            <Animated.View style={[
              styles.zodiacContainer,
              {
                opacity: zodiacAnimValue,
                transform: [{
                  scale: zodiacAnimValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              },
            ]}>
              <Text style={styles.zodiacEmoji}>{zodiacSign.emoji}</Text>
              <Text style={styles.zodiacTitle}>
                Demek bir {zodiacSign.nameTR} burcusun!
              </Text>
              <Text style={styles.zodiacMessage}>
                {getZodiacMessage(zodiacSign)} ✨
              </Text>
            </Animated.View>
          )}

          {/* Yaş uyarısı */}
          {calculatedAge !== null && calculatedAge < 18 && (
            <View style={styles.ageWarning}>
              <Text style={styles.ageWarningText}>
                ⚠️ CardMatch için 18 yaşından büyük olmalısın
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // Adım 3: Cinsiyet
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepEmoji}>✨</Text>
      <Text style={styles.stepTitle}>Profil Bilgini Tamamla</Text>
      <Text style={styles.stepSubtitle}>
        Eşleşmeleri daha uyumlu yapmak için kullanılır.
      </Text>

      <View style={[styles.genderOptions, { marginTop: SPACING.lg }]}>
        <TouchableOpacity
          style={[
            styles.genderCard,
            gender === 'MALE' && styles.genderCardActive,
          ]}
          onPress={() => setGender('MALE')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.genderText,
            gender === 'MALE' && styles.genderTextActive,
          ]}>
            Erkek
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.genderCard,
            gender === 'FEMALE' && styles.genderCardActive,
          ]}
          onPress={() => setGender('FEMALE')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.genderText,
            gender === 'FEMALE' && styles.genderTextActive,
          ]}>
            Kadın
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.genderCard,
            gender === 'OTHER' && styles.genderCardActive,
          ]}
          onPress={() => setGender('OTHER')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.genderText,
            gender === 'OTHER' && styles.genderTextActive,
          ]}>
            Diğer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Konum izni modalı
  const renderLocationModal = () => (
    <Modal
      visible={showLocationModal}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalEmoji}>📍</Text>
          <Text style={styles.modalTitle}>Konum İzni Gerekli</Text>
          <Text style={styles.modalText}>
            CardMatch yakınındaki insanlarla seni eşleştirebilmek için konum iznine ihtiyaç duyuyor.
          </Text>
          <TouchableOpacity 
            style={styles.modalButton}
            onPress={requestLocation}
          >
            <Text style={styles.modalButtonText}>İzin Ver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          {currentStep > 1 ? (
            <TouchableOpacity 
              onPress={prevStep} 
              style={styles.backTouchable}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Text style={styles.backButton}>← Geri</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={handleLogout} 
              style={styles.backTouchable}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutButton}>✕ Çıkış</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.stepIndicator}>
            {currentStep} / {TOTAL_STEPS}
          </Text>
          <View style={{ width: 70 }} />
        </View>

        {renderProgress()}

        {/* Steps */}
        <View style={styles.stepsContainer}>
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </View>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !isStepValid() && styles.continueButtonDisabled,
            ]}
            onPress={nextStep}
            disabled={!isStepValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <Text style={styles.continueButtonText}>
                Devam Et →
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Step 1 için micro-copy */}
          {currentStep === 1 && (
            <>
              {/* Disabled durumunda yardımcı metin */}
              {nickname.length === 0 && (
                <Text style={styles.ctaHelperText}>
                  Bir kullanıcı adı yazmalısın
                </Text>
              )}
              {/* Aktif durumunda önemli bilgi */}
              {nickname.length > 0 && (
                <Text style={styles.ctaMicroCopy}>
                  Bu isim sohbetlerde görünecek
                </Text>
              )}
            </>
          )}
          
          {/* Step 2 için micro-copy */}
          {currentStep === 2 && (
            <>
              {/* Tarih eksik */}
              {(birthDay.length < 2 || birthMonth.length < 2 || birthYear.length < 4) && (
                <Text style={styles.ctaHelperText}>
                  Doğum tarihini tamamla
                </Text>
              )}
              {/* Yaş uygun değil */}
              {calculatedAge !== null && calculatedAge < 18 && (
                <Text style={styles.ctaHelperText}>
                  18 yaşından büyük olmalısın
                </Text>
              )}
            </>
          )}
          
          {/* Step 3 için micro-copy */}
          {currentStep === 3 && (
            <>
              {/* Seçim yapılmadı */}
              {gender === null && (
                <Text style={styles.ctaHelperText}>
                  Bir seçenek seçmelisin
                </Text>
              )}
            </>
          )}
        </View>

        {renderLocationModal()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backTouchable: {
    padding: SPACING.xs,
  },
  backButton: {
    ...FONTS.body,
    color: COLORS.primary,
  },
  logoutButton: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  stepIndicator: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  progressDot: {
    width: 50,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surface,
  },
  progressDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepsContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
  },
  stepContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  stepScrollView: {
    flex: 1,
    width: '100%',
  },
  stepScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl * 2,
  },
  dismissArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  stepEmoji: {
    fontSize: 60,
    marginBottom: SPACING.md,
  },
  stepTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  stepSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  // Input styles
  inputContainer: {
    width: '100%',
    position: 'relative',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    paddingRight: 50,
    color: COLORS.text,
    fontSize: 18,
    width: '100%',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  inputSuccess: {
    borderColor: COLORS.success,
  },
  inputIcon: {
    position: 'absolute',
    right: SPACING.lg,
    top: '50%',
    marginTop: -10,
  },
  inputIconSuccess: {
    position: 'absolute',
    right: SPACING.lg,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: COLORS.success,
  },
  inputIconError: {
    position: 'absolute',
    right: SPACING.lg,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: COLORS.danger,
  },
  inputRules: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    opacity: 0.7,
  },
  errorText: {
    ...FONTS.caption,
    color: COLORS.danger,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  successText: {
    ...FONTS.caption,
    color: COLORS.success,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  hintText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  // Birth date styles
  birthDateRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  birthInputContainer: {
    alignItems: 'center',
  },
  birthLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  birthLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  birthInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    width: 70,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  birthInputActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  birthInputYear: {
    width: 100,
  },
  birthTrustText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    opacity: 0.7,
  },
  // Zodiac styles
  zodiacContainer: {
    marginTop: SPACING.xl * 2,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: 20,
    width: '100%',
  },
  zodiacEmoji: {
    fontSize: 50,
    marginBottom: SPACING.sm,
  },
  zodiacTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    textAlign: 'center',
  },
  zodiacMessage: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  ageWarning: {
    marginTop: SPACING.xl,
    backgroundColor: 'rgba(255, 100, 100, 0.1)',
    padding: SPACING.md,
    borderRadius: 12,
  },
  ageWarningText: {
    ...FONTS.body,
    color: COLORS.danger,
    textAlign: 'center',
  },
  // Gender styles
  genderOptions: {
    width: '100%',
    gap: SPACING.md,
  },
  genderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  genderText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    fontSize: 17,
    fontWeight: '500',
  },
  genderTextActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  // Footer
  footer: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xl * 1.5,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 18,
  },
  ctaMicroCopy: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  ctaHelperText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    opacity: 0.7,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
  },
  modalEmoji: {
    fontSize: 50,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl * 2,
    borderRadius: 999,
  },
  modalButtonText: {
    ...FONTS.button,
    color: COLORS.background,
  },
});

export default ProfileSetupScreen;
