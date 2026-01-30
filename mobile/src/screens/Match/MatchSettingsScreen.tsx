import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<ChatStackParamList, 'MatchSettings'>;

const MatchSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [minAge, setMinAge] = useState(user?.filterMinAge || 18);
  const [maxAge, setMaxAge] = useState(user?.filterMaxAge || 99);
  const [maxDistance, setMaxDistance] = useState(user?.filterMaxDistance || 160);
  const [filterGender, setFilterGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | 'BOTH'>((user as any)?.filterGender || 'BOTH');
  const [saving, setSaving] = useState(false);
  
  // TextInput için string değerler
  const [minAgeText, setMinAgeText] = useState(String(user?.filterMinAge || 18));
  const [maxAgeText, setMaxAgeText] = useState(String(user?.filterMaxAge || 99));

  // Prime kontrolü
  const isPrime = user?.isPrime || false;

  // Min yaş değişikliği
  const handleMinAgeChange = (text: string) => {
    // Sadece rakam kabul et
    const numericText = text.replace(/[^0-9]/g, '');
    setMinAgeText(numericText);
  };

  const handleMinAgeBlur = () => {
    let value = parseInt(minAgeText, 10);
    if (isNaN(value) || value < 18) value = 18;
    if (value > 99) value = 99;
    setMinAge(value);
    setMinAgeText(String(value));
  };

  // Max yaş değişikliği
  const handleMaxAgeChange = (text: string) => {
    // Sadece rakam kabul et
    const numericText = text.replace(/[^0-9]/g, '');
    setMaxAgeText(numericText);
  };

  const handleMaxAgeBlur = () => {
    let value = parseInt(maxAgeText, 10);
    if (isNaN(value) || value < 18) value = 18;
    if (value > 99) value = 99;
    setMaxAge(value);
    setMaxAgeText(String(value));
  };

  const handleSave = async () => {
    if (!isPrime) {
      Alert.alert(
        '👑 Prime Özelliği',
        'Yaş ve mesafe filtreleme sadece Prime üyelere açıktır.',
        [
          { text: 'Tamam', style: 'cancel' },
          { text: 'Prime\'a Geç', onPress: () => navigation.goBack() },
        ]
      );
      return;
    }

    // Min > Max kontrolü
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
        filterGender: filterGender,
      });
      await refreshProfile();
      Alert.alert('Başarılı', 'Eşleşme ayarlarınız kaydedildi!');
      navigation.goBack();
    } catch (error) {
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
        <Text style={styles.sectionTitle}>Yaş Aralığı</Text>
        <Text style={styles.ageHint}>Butonları kullanın veya yaşı direkt yazın</Text>
        
        {/* Min Yaş */}
        <View style={styles.ageControlRow}>
          <Text style={styles.ageControlLabel}>Minimum Yaş</Text>
          <View style={styles.ageControls}>
            <TouchableOpacity 
              style={[styles.ageButton, (!isPrime || minAge <= 18) && styles.ageButtonDisabled]} 
              onPress={() => { if (minAge > 18) { setMinAge(minAge - 1); setMinAgeText(String(minAge - 1)); } }}
              disabled={!isPrime || minAge <= 18}
            >
              <Text style={styles.ageButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.ageInput, !isPrime && styles.ageInputDisabled]}
              value={minAgeText}
              onChangeText={handleMinAgeChange}
              onBlur={handleMinAgeBlur}
              keyboardType="number-pad"
              maxLength={2}
              editable={isPrime}
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <TouchableOpacity 
              style={[styles.ageButton, (!isPrime || minAge >= 99) && styles.ageButtonDisabled]} 
              onPress={() => { if (minAge < 99) { setMinAge(minAge + 1); setMinAgeText(String(minAge + 1)); } }}
              disabled={!isPrime || minAge >= 99}
            >
              <Text style={styles.ageButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Max Yaş */}
        <View style={styles.ageControlRow}>
          <Text style={styles.ageControlLabel}>Maksimum Yaş</Text>
          <View style={styles.ageControls}>
            <TouchableOpacity 
              style={[styles.ageButton, (!isPrime || maxAge <= 18) && styles.ageButtonDisabled]} 
              onPress={() => { if (maxAge > 18) { setMaxAge(maxAge - 1); setMaxAgeText(String(maxAge - 1)); } }}
              disabled={!isPrime || maxAge <= 18}
            >
              <Text style={styles.ageButtonText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.ageInput, !isPrime && styles.ageInputDisabled]}
              value={maxAgeText}
              onChangeText={handleMaxAgeChange}
              onBlur={handleMaxAgeBlur}
              keyboardType="number-pad"
              maxLength={2}
              editable={isPrime}
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <TouchableOpacity 
              style={[styles.ageButton, (!isPrime || maxAge >= 99) && styles.ageButtonDisabled]} 
              onPress={() => { if (maxAge < 99) { setMaxAge(maxAge + 1); setMaxAgeText(String(maxAge + 1)); } }}
              disabled={!isPrime || maxAge >= 99}
            >
              <Text style={styles.ageButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Özet gösterim */}
        <View style={styles.ageSummary}>
          <Text style={styles.ageSummaryText}>{minAge} - {maxAge} yaş arası kişilerle eşleşeceksiniz</Text>
        </View>
      </View>

      <View style={[styles.section, !isPrime && styles.disabled]}>
        <Text style={styles.sectionTitle}>Mesafe Filtresi</Text>
        <Text style={styles.distanceValue}>
          {maxDistance >= 160 ? '160+ km (Tüm Türkiye)' : `${maxDistance} km`}
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={5}
          maximumValue={160}
          step={5}
          value={maxDistance}
          onValueChange={setMaxDistance}
          minimumTrackTintColor={COLORS.primary}
          maximumTrackTintColor={COLORS.surface}
          thumbTintColor={isPrime ? COLORS.primary : COLORS.textMuted}
          disabled={!isPrime}
        />
        <View style={styles.distanceLabels}>
          <Text style={styles.distanceLabel}>5 km</Text>
          <Text style={styles.distanceLabel}>160+ km</Text>
        </View>
      </View>

      {/* Cinsiyet Filtresi - Sadece Prime */}
      <View style={[styles.section, !isPrime && styles.disabled]}>
        <Text style={styles.sectionTitle}>👑 Cinsiyet Tercihi</Text>
        <Text style={styles.genderHint}>Kiminle eşleşmek istiyorsun?</Text>
        
        {/* İlk satır: Erkek ve Kadın */}
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[
              styles.genderOption,
              filterGender === 'MALE' && styles.genderOptionActive,
              !isPrime && styles.genderOptionDisabled,
            ]}
            onPress={() => isPrime && setFilterGender('MALE')}
            disabled={!isPrime}
          >
            <Text style={styles.genderEmoji}>👨</Text>
            <Text style={[
              styles.genderText,
              filterGender === 'MALE' && styles.genderTextActive,
            ]}>Erkek</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.genderOption,
              filterGender === 'FEMALE' && styles.genderOptionActive,
              !isPrime && styles.genderOptionDisabled,
            ]}
            onPress={() => isPrime && setFilterGender('FEMALE')}
            disabled={!isPrime}
          >
            <Text style={styles.genderEmoji}>👩</Text>
            <Text style={[
              styles.genderText,
              filterGender === 'FEMALE' && styles.genderTextActive,
            ]}>Kadın</Text>
          </TouchableOpacity>
        </View>
        
        {/* İkinci satır: Diğer ve Herkes */}
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[
              styles.genderOption,
              filterGender === 'OTHER' && styles.genderOptionActive,
              !isPrime && styles.genderOptionDisabled,
            ]}
            onPress={() => isPrime && setFilterGender('OTHER')}
            disabled={!isPrime}
          >
            <Text style={styles.genderEmoji}>🌈</Text>
            <Text style={[
              styles.genderText,
              filterGender === 'OTHER' && styles.genderTextActive,
            ]}>Diğer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.genderOption,
              filterGender === 'BOTH' && styles.genderOptionActive,
              !isPrime && styles.genderOptionDisabled,
            ]}
            onPress={() => isPrime && setFilterGender('BOTH')}
            disabled={!isPrime}
          >
            <Text style={styles.genderEmoji}>✨</Text>
            <Text style={[
              styles.genderText,
              filterGender === 'BOTH' && styles.genderTextActive,
            ]}>Herkes</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  primeWarningIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  primeWarningText: {
    ...FONTS.body,
    color: '#FFD700',
    flex: 1,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  sectionTitle: {
    ...FONTS.h3,
    marginBottom: SPACING.sm,
  },
  ageHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  ageControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ageControlLabel: {
    ...FONTS.body,
    color: COLORS.text,
    flex: 1,
  },
  ageControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ageButtonDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.5,
  },
  ageButtonText: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  ageInput: {
    width: 60,
    height: 40,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginHorizontal: SPACING.sm,
  },
  ageInputDisabled: {
    borderColor: COLORS.textMuted,
    color: COLORS.textMuted,
  },
  ageSummary: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    alignItems: 'center',
  },
  ageSummaryText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  distanceValue: {
    ...FONTS.h3,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distanceLabel: {
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
  // Cinsiyet filtresi stilleri
  genderHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  genderOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  genderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  genderOption: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  genderOptionDisabled: {
    opacity: 0.5,
  },
  genderEmoji: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  genderText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  genderTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default MatchSettingsScreen;
