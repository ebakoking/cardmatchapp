import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type FilterType = 'FEMALE' | 'BOTH' | 'MALE';

interface GenderFilterStatus {
  active: boolean;
  filterType: FilterType;
  expiresAt: string | null;
}

export const GenderFilterBar: React.FC = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>('BOTH');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10 saniyede bir kontrol
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!expiresAt || !activeFilter || activeFilter === 'BOTH') {
      setTimeLeft('');
      return;
    }

    const timer = setInterval(() => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setActiveFilter('BOTH');
        setExpiresAt(null);
        setTimeLeft('');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, activeFilter]);

  const fetchStatus = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        filterType?: FilterType;
        expiresAt?: string | null;
        active?: boolean;
      }>('/api/gender-filter/status');
      if (response.data.success) {
        setActiveFilter(response.data.filterType ?? 'BOTH');
        setExpiresAt(
          response.data.expiresAt ? new Date(response.data.expiresAt) : null
        );
      }
    } catch (error) {
      console.error('[GenderFilter] Status error:', error);
    }
  };

  const handleFilterPress = async (filterType: FilterType) => {
    if (loading) return;

    try {
      setLoading(true);
      const response = await api.post<{ success: boolean; message: string; filterType: FilterType; expiresAt: string | null; newBalance: number }>(
        '/api/gender-filter/activate',
        { filterType }
      );

      if (response.data.success) {
        setActiveFilter(filterType);
        setExpiresAt(response.data.expiresAt ? new Date(response.data.expiresAt) : null);

        Alert.alert('✅ Başarılı', response.data.message);
      }
    } catch (error: any) {
      const resData = error?.response?.data;
      console.error('[GenderFilter] Activate error:', resData || error);

      const errorCode = resData?.error?.code;
      const errorMsg =
        resData?.error?.message ||
        (typeof resData?.error === 'string' ? resData.error : null) ||
        error?.message ||
        'Bir hata oluştu. Lütfen tekrar dene.';

      if (errorCode === 'INSUFFICIENT_BALANCE') {
        const required = error.response.data.required || 50;
        const balance = error.response.data.balance || 0;

        Alert.alert(
          '💎 Yetersiz Bakiye',
          `${required} elmas gerekiyor\nMevcut bakiye: ${balance} 💎`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Elmas Al',
              onPress: () => {
                // TODO: Navigate to token purchase screen
                console.log('[GenderFilter] Navigate to token purchase');
              },
            },
          ]
        );
      } else {
        Alert.alert('Hata', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Eşleşme Tercihi</Text>
        {timeLeft && (
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={14} color={COLORS.accent} />
            <Text style={styles.timerText}>{timeLeft}</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonsRow}>
        {/* KADIN */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleFilterPress('FEMALE')}
          disabled={loading}
        >
          <View
            style={[
              styles.iconContainer,
              activeFilter === 'FEMALE' && styles.iconContainerActive,
            ]}
          >
            <Ionicons
              name="female"
              size={28}
              color={activeFilter === 'FEMALE' ? '#FF69B4' : COLORS.textMuted}
            />
          </View>
          <Text
            style={[
              styles.label,
              activeFilter === 'FEMALE' && styles.labelActive,
            ]}
          >
            Kadın
          </Text>
          {activeFilter === 'FEMALE' && <View style={styles.activeLine} />}
        </TouchableOpacity>

        {/* HERKES */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleFilterPress('BOTH')}
          disabled={loading}
        >
          <View
            style={[
              styles.iconContainer,
              activeFilter === 'BOTH' && styles.iconContainerActive,
            ]}
          >
            <Ionicons
              name="earth"
              size={28}
              color={activeFilter === 'BOTH' ? COLORS.accent : COLORS.textMuted}
            />
          </View>
          <Text
            style={[
              styles.label,
              activeFilter === 'BOTH' && styles.labelActive,
            ]}
          >
            Herkes
          </Text>
          {activeFilter === 'BOTH' && <View style={styles.activeLine} />}
        </TouchableOpacity>

        {/* ERKEK */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleFilterPress('MALE')}
          disabled={loading}
        >
          <View
            style={[
              styles.iconContainer,
              activeFilter === 'MALE' && styles.iconContainerActive,
            ]}
          >
            <Ionicons
              name="male"
              size={28}
              color={activeFilter === 'MALE' ? '#4FACFE' : COLORS.textMuted}
            />
          </View>
          <Text
            style={[
              styles.label,
              activeFilter === 'MALE' && styles.labelActive,
            ]}
          >
            Erkek
          </Text>
          {activeFilter === 'MALE' && <View style={styles.activeLine} />}
        </TouchableOpacity>
      </View>

      {activeFilter === 'BOTH' && !loading && (
        <View style={styles.hintContainer}>
          <Ionicons name="diamond-outline" size={14} color={COLORS.accent} />
          <Text style={styles.hint}>50 💎 ile 30 dk cinsiyet seçimi</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.accent} size="small" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    // Shadow
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    gap: 4,
  },
  timerText: {
    ...FONTS.caption,
    color: COLORS.accent,
    fontWeight: '600',
    fontSize: 13,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  button: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: SPACING.sm,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  iconContainerActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surfaceLight,
  },
  label: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
    fontSize: 12,
  },
  labelActive: {
    color: COLORS.text,
    fontWeight: '600',
  },
  activeLine: {
    width: 32,
    height: 3,
    backgroundColor: COLORS.accent,
    marginTop: 6,
    borderRadius: 2,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    gap: 6,
  },
  hint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  loadingContainer: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
});
