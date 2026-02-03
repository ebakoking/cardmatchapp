import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Slider } from '@miblanchard/react-native-slider';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<ChatStackParamList, 'MatchSettings'>;

const MIN_KM = 5;
const MAX_KM = 160;
const STEP_KM = 5;
const MIN_AGE = 18;
const MAX_AGE = 40; // 40 = "40+"

const SLIDER_ACCENT = COLORS.accent;
const TRACK_INACTIVE = '#555570';

const MatchSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [minAge, setMinAge] = useState(user?.filterMinAge ?? 18);
  const [maxAge, setMaxAge] = useState(Math.min(MAX_AGE, user?.filterMaxAge ?? MAX_AGE));
  const [maxDistance, setMaxDistance] = useState(user?.filterMaxDistance ?? 80);
  const [saving, setSaving] = useState(false);

  const isPrime = user?.isPrime || false;

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
  };

  const handleDistanceChange = (value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    const rounded = Math.round(v / STEP_KM) * STEP_KM;
    setMaxDistance(Math.max(MIN_KM, Math.min(MAX_KM, rounded)));
  };

  const handleMinAgeChange = (value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    const newMin = Math.round(Math.max(MIN_AGE, Math.min(MAX_AGE, v)));
    setMinAge(newMin);
    if (newMin >= maxAge) setMaxAge(Math.min(MAX_AGE, newMin + 1));
  };

  const handleMaxAgeChange = (value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    const newMax = Math.round(Math.max(MIN_AGE, Math.min(MAX_AGE, v)));
    setMaxAge(newMax);
    if (newMax <= minAge) setMinAge(Math.max(MIN_AGE, newMax - 1));
  };

  const handleSave = async () => {
    if (!isPrime) {
      Alert.alert(
        '👑 Prime Özelliği',
        'Yaş ve mesafe filtreleme sadece Prime üyelere açıktır.',
        [
          { text: 'Tamam', style: 'cancel' },
          { text: "Prime'a Geç", onPress: () => navigation.goBack() },
        ]
      );
      return;
    }
    if (minAge > maxAge) {
      Alert.alert('Uyarı', 'Minimum yaş, maksimum yaştan büyük olamaz.');
      return;
    }
    try {
      setSaving(true);
      await api.put('/api/user/me', {
        filterMinAge: minAge,
        filterMaxAge: maxAge,
        filterMaxDistance: maxDistance,
      });
      await refreshProfile();
      Alert.alert('Başarılı', 'Eşleşme ayarlarınız kaydedildi!');
      navigation.goBack();
    } catch (error: any) {
      console.log('Filter save error:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Geri</Text>
        </TouchableOpacity>
        <Text style={FONTS.h2}>Eşleşme Ayarları</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isPrime && (
          <View style={styles.primeWarning}>
            <Text style={styles.primeWarningIcon}>👑</Text>
            <Text style={styles.primeWarningText}>
              Bu özellikler sadece Prime üyelere açıktır.
            </Text>
          </View>
        )}

        <View style={[styles.section, !isPrime && styles.disabled]}>
          <Text style={styles.sectionTitle}>Mesafe Filtresi</Text>
          <Text style={styles.valueLabel}>
            {maxDistance >= MAX_KM ? `${MAX_KM}+ km (Tüm Türkiye)` : `${maxDistance} km`}
          </Text>
          <View style={styles.sliderWrap}>
            <Slider
              value={maxDistance}
              onValueChange={handleDistanceChange}
              onSlidingComplete={triggerHaptic}
              minimumValue={MIN_KM}
              maximumValue={MAX_KM}
              step={STEP_KM}
              minimumTrackTintColor={SLIDER_ACCENT}
              maximumTrackTintColor={TRACK_INACTIVE}
              thumbTintColor={SLIDER_ACCENT}
              disabled={!isPrime}
              trackClickable
            />
          </View>
          <View style={styles.rangeLabels}>
            <Text style={styles.rangeLabel}>{MIN_KM} km</Text>
            <Text style={styles.rangeLabel}>{MAX_KM}+ km</Text>
          </View>
        </View>

        <View style={[styles.section, !isPrime && styles.disabled]}>
          <Text style={styles.sectionTitle}>Yaş Aralığı</Text>
          <Text style={styles.hint}>18 – 40+ yaş arası seçin</Text>

          <Text style={styles.sublabel}>Minimum: {minAge}</Text>
          <View style={styles.sliderWrap}>
            <Slider
              value={minAge}
              onValueChange={handleMinAgeChange}
              onSlidingComplete={triggerHaptic}
              minimumValue={MIN_AGE}
              maximumValue={MAX_AGE}
              step={1}
              minimumTrackTintColor={SLIDER_ACCENT}
              maximumTrackTintColor={TRACK_INACTIVE}
              thumbTintColor={SLIDER_ACCENT}
              disabled={!isPrime}
              trackClickable
            />
          </View>

          <Text style={[styles.sublabel, { marginTop: SPACING.lg }]}>
            Maksimum: {maxAge === MAX_AGE ? '40+' : maxAge}
          </Text>
          <View style={styles.sliderWrap}>
            <Slider
              value={maxAge}
              onValueChange={handleMaxAgeChange}
              onSlidingComplete={triggerHaptic}
              minimumValue={MIN_AGE}
              maximumValue={MAX_AGE}
              step={1}
              minimumTrackTintColor={SLIDER_ACCENT}
              maximumTrackTintColor={TRACK_INACTIVE}
              thumbTintColor={SLIDER_ACCENT}
              disabled={!isPrime}
              trackClickable
            />
          </View>

          <Text style={styles.valueLabel}>
            {minAge} – {maxAge === MAX_AGE ? '40+' : maxAge} yaş arası
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !isPrime && styles.disabledButton]}
          onPress={handleSave}
          disabled={saving || !isPrime}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={FONTS.button}>
              {isPrime ? 'Kaydet' : '👑 Prime ile Kullan'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  backButton: {
    ...FONTS.body,
    color: COLORS.primary,
  },
  primeWarning: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  primeWarningIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  primeWarningText: {
    ...FONTS.body,
    color: COLORS.accent,
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  disabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    ...FONTS.h3,
    marginBottom: SPACING.sm,
  },
  hint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  sublabel: {
    ...FONTS.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  sliderWrap: {
    width: '100%',
    marginVertical: SPACING.sm,
  },
  valueLabel: {
    ...FONTS.h3,
    color: COLORS.accent,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  rangeLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  disabledButton: {
    backgroundColor: COLORS.surface,
  },
});

export default MatchSettingsScreen;
