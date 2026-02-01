import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Tutorial'>;

const slides = [
  {
    emoji: '🎯',
    title: 'Eşleşmeye Gir',
    text: 'Benzer cevaplar veren biriyle eşleş.',
  },
  {
    emoji: '🃏',
    title: 'Kartları Cevapla',
    text: 'En az 2 kart uyuşursa sohbet açılır.',
  },
  {
    emoji: '💬',
    title: 'Aşamalı Tanış',
    text: 'Önce sohbet. Sonra ses, fotoğraf ve video.',
  },
  {
    emoji: '✨',
    title: 'Spark Kazan',
    text: 'Paylaşımların açıldıkça Spark kazanırsın.',
  },
];

const { width } = Dimensions.get('window');

const TutorialScreen: React.FC<Props> = () => {
  const { completeOnboarding, refreshProfile, user } = useAuth();
  const [index, setIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const finishOnboarding = async () => {
    if (isFinishing) return; // Çift tıklamayı önle
    setIsFinishing(true);
    
    console.log('[Tutorial] Starting finishOnboarding...');
    console.log('[Tutorial] Current user before refresh:', user?.nickname, user?.id);
    
    // Önce profili güncelle (ProfileSetup'ta yapmadık)
    try {
      await refreshProfile();
      console.log('[Tutorial] Profile refreshed successfully');
    } catch (e) {
      console.log('[Tutorial] refreshProfile error (continuing anyway):', e);
    }
    
    // Sonra onboarding'i tamamla - bu RootNavigator'ı yeniden render edecek
    console.log('[Tutorial] Calling completeOnboarding...');
    await completeOnboarding();
    console.log('[Tutorial] Onboarding completed! Navigation should switch to MainTabs now.');
  };

  const next = async () => {
    if (index < slides.length - 1) {
      setIndex((prev) => prev + 1);
    } else {
      await finishOnboarding();
    }
  };

  const skip = async () => {
    await finishOnboarding();
  };

  const isLast = index === slides.length - 1;
  const currentSlide = slides[index];

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={skip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      )}

      <View style={styles.slide}>
        <Text style={styles.emoji}>{currentSlide.emoji}</Text>
        <Text style={styles.title}>{currentSlide.title}</Text>
        <Text style={styles.text}>{currentSlide.text}</Text>
      </View>

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Button */}
      <TouchableOpacity 
        style={[styles.button, isFinishing && styles.buttonDisabled]} 
        onPress={next}
        disabled={isFinishing}
      >
        <Text style={styles.buttonText}>
          {isFinishing ? 'Yükleniyor...' : isLast ? '🚀 Eşleşmeye Başla' : 'Devam'}
        </Text>
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
  skipButton: {
    alignSelf: 'flex-end',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  skipText: {
    fontSize: 14,
    color: COLORS.textMuted,
    opacity: 0.6,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emoji: {
    fontSize: 72,
    marginBottom: SPACING.lg,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  text: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 18,
  },
});

export default TutorialScreen;
