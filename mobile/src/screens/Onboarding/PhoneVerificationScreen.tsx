import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneVerification'>;

const PhoneVerificationScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();

  const requestOtp = async () => {
    try {
      setLoading(true);
      await api.post('/api/auth/request-otp', { phoneNumber });
      setStep('code');
    } catch {
      // noop: backend already returns human-readable errors
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      const res = await api.post('/api/auth/verify-otp', { phoneNumber, code });
      const { token, user } = res.data.data;
      await loginWithToken(token, user);
      // State güncellemesinden sonra navigasyonun düzgün çalışması için kısa gecikme
      setTimeout(() => {
        navigation.replace('ProfileSetup');
      }, 100);
    } catch {
      // handle error with toast in future
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={FONTS.h1}>CardMatch</Text>
      {step === 'phone' ? (
        <>
          <Text style={styles.label}>Telefon numaran</Text>
          <TextInput
            style={styles.input}
            placeholder="+90..."
            placeholderTextColor={COLORS.textMuted}
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={requestOtp}
            disabled={loading}
          >
            <Text style={FONTS.button}>
              {loading ? 'Gönderiliyor...' : 'OTP Gönder'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>SMS ile gelen kod</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            style={styles.button}
            onPress={verifyOtp}
            disabled={loading}
          >
            <Text style={FONTS.button}>
              {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  label: {
    ...FONTS.body,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  input: {
    borderRadius: 12,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  button: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

export default PhoneVerificationScreen;

