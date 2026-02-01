import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Interests'>;

// Önerilen ilgi alanları kategorileri
const SUGGESTED_INTERESTS = {
  'Müzik': ['Pop', 'Rock', 'Rap', 'Jazz', 'Klasik', 'Elektronik', 'R&B', 'Metal', 'Indie'],
  'Spor': ['Futbol', 'Basketbol', 'Yüzme', 'Fitness', 'Koşu', 'Yoga', 'Tenis', 'Voleybol'],
  'Hobiler': ['Seyahat', 'Fotoğrafçılık', 'Yemek', 'Film', 'Oyun', 'Okuma', 'Dans', 'Resim'],
  'Yaşam': ['Kedi', 'Köpek', 'Kahve', 'Çay', 'Doğa', 'Gece Hayatı', 'Ev', 'Macera'],
  'Teknoloji': ['Yazılım', 'Tasarım', 'Startup', 'Kripto', 'AI', 'Oyun', 'Gadget'],
};

const MAX_INTERESTS = 10;

const InterestsScreen: React.FC<Props> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Mevcut interestleri yükle
  useEffect(() => {
    if (user?.interests) {
      setSelectedInterests(user.interests);
    }
  }, [user?.interests]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) {
        return prev.filter((i) => i !== interest);
      }
      if (prev.length >= MAX_INTERESTS) {
        Alert.alert('Limit', `En fazla ${MAX_INTERESTS} ilgi alanı seçebilirsin.`);
        return prev;
      }
      return [...prev, interest];
    });
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (!trimmed) return;
    
    if (selectedInterests.includes(trimmed)) {
      Alert.alert('Zaten Ekli', 'Bu ilgi alanı zaten listende var.');
      return;
    }
    
    if (selectedInterests.length >= MAX_INTERESTS) {
      Alert.alert('Limit', `En fazla ${MAX_INTERESTS} ilgi alanı seçebilirsin.`);
      return;
    }
    
    setSelectedInterests((prev) => [...prev, trimmed]);
    setCustomInterest('');
  };

  const saveInterests = async () => {
    try {
      setSaving(true);
      await api.put('/api/user/me', { interests: selectedInterests });
      await refreshProfile();
      Alert.alert('Kaydedildi!', 'İlgi alanların güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Hata', 'İlgi alanları kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İlgi Alanları</Text>
        <TouchableOpacity onPress={saveInterests} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.saveButton}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Açıklama */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={COLORS.primary} />
          <Text style={styles.infoText}>
            İlgi alanlarını seç! Ortak ilgi alanları olan kişilerle eşleşme şansın artar.
          </Text>
        </View>

        {/* Seçili interestler */}
        {selectedInterests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Seçilen ({selectedInterests.length}/{MAX_INTERESTS})
            </Text>
            <View style={styles.tagsContainer}>
              {selectedInterests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[styles.tag, styles.tagSelected]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={styles.tagTextSelected}>{interest}</Text>
                  <Ionicons name="close-circle" size={16} color={COLORS.text} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Custom interest ekleme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kendi İlgi Alanını Ekle</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              value={customInterest}
              onChangeText={setCustomInterest}
              placeholder="örn: Anime, Kahve, Yoga..."
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
              onSubmitEditing={addCustomInterest}
            />
            <TouchableOpacity style={styles.addButton} onPress={addCustomInterest}>
              <Ionicons name="add" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Önerilen kategoriler */}
        {Object.entries(SUGGESTED_INTERESTS).map(([category, interests]) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <View style={styles.tagsContainer}>
              {interests.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.tag, isSelected && styles.tagSelected]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <Text style={isSelected ? styles.tagTextSelected : styles.tagText}>
                      {interest}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color={COLORS.text} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  saveButton: {
    ...FONTS.body,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  infoText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    flex: 1,
  },
  section: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tagText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  tagTextSelected: {
    ...FONTS.caption,
    color: COLORS.text,
    fontWeight: '500',
  },
  customInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  customInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    ...FONTS.body,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default InterestsScreen;
