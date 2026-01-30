import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

interface Props {
  currentStage: number;
  timeRemaining: number;
  totalDuration?: number; // saniye cinsinden (her stage için)
}

// Stage isimleri
const STAGE_NAMES: Record<number, string> = {
  1: 'Yazı',
  2: 'Ses',
  3: 'Foto',
  4: 'Video',
  5: 'Arkadaş',
};

const StageIndicator: React.FC<Props> = ({
  currentStage,
  timeRemaining,
  totalDuration = 2 * 60, // Her stage 2 dakika (test için)
}) => {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  const ratio = Math.max(0, Math.min(1, timeRemaining / totalDuration));

  // Stage 5'te sınırsız
  const isUnlimited = currentStage >= 5;
  
  return (
    <View style={styles.container}>
      <Text style={FONTS.caption}>
        {currentStage}/5 {STAGE_NAMES[currentStage] || ''}
      </Text>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={FONTS.caption}>
        {isUnlimited ? '∞' : `${mins}:${secs.toString().padStart(2, '0')}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  barBackground: {
    width: 120,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    backgroundColor: COLORS.accent,
  },
});

export default StageIndicator;

