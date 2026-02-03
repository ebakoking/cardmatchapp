import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Animated,
  Easing,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useIAPContext } from '../context/IAPContext';
import { IAP_PRODUCT_IDS } from '../constants/iapProducts';

interface BoostStatus {
  isActive: boolean;
  expiresAt: string | null;
  remainingSeconds: number;
  totalBoostsUsed: number;
  price: number;
  durationHours: number;
  productId: string;
}

interface Props {
  onBoostActivated?: () => void;
}

const BoostButton: React.FC<Props> = ({ onBoostActivated }) => {
  const { refreshProfile, user } = useAuth();
  const { isReady: iapReady, purchaseItem, finishTransaction } = useIAPContext();
  const [status, setStatus] = useState<BoostStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rocketAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Pulse animation for active boost
  useEffect(() => {
    if (status?.isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status?.isActive]);

  // Rocket launch animation
  const animateRocket = () => {
    rocketAnim.setValue(0);
    Animated.timing(rocketAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  };

  // Load boost status - sadece token varsa çağır
  const loadStatus = async () => {
    // Kullanıcı yoksa çağırma
    if (!user?.id) return;
    
    // Token var mı kontrol et
    const SecureStore = require('expo-secure-store');
    const token = await SecureStore.getItemAsync('access_token');
    if (!token) {
      console.log('[BoostButton] Token not ready yet, skipping status check');
      return;
    }
    
    try {
      const res = await api.get<{ success: boolean; data: BoostStatus }>('/api/boost/status');
      if (res.data.success && res.data.data) {
        setStatus(res.data.data);
        setTimeRemaining(res.data.data.remainingSeconds);
      }
    } catch {
      // Tüm hataları sessizce ignore et
      setStatus(null);
    }
  };

  useEffect(() => {
    // Kullanıcı giriş yaptıktan 1 saniye sonra kontrol et
    if (user?.id) {
      const timer = setTimeout(() => {
        loadStatus();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  // Timer countdown
  useEffect(() => {
    if (status?.isActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            loadStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [status?.isActive, timeRemaining]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}s ${minutes}dk`;
    }
    return `${minutes}dk ${secs}sn`;
  };

  const handlePurchaseBoost = async () => {
    try {
      setLoading(true);

      if (iapReady) {
        const purchase = await purchaseItem(IAP_PRODUCT_IDS.BOOST_1H);
        const transactionId = (purchase as any).transactionId ?? (purchase as any).transactionReceipt ?? '';
        const purchaseToken = (purchase as any).purchaseToken ?? (purchase as any).transactionReceipt ?? transactionId;
        const res = await api.post<{ success: boolean; message: string; data: any }>(
          '/api/boost/activate',
          { transactionId, purchaseToken }
        );
        if (res.data.success) {
          await finishTransaction(purchase, true);
          Vibration.vibrate(100);
          animateRocket();
          Alert.alert('Boost Aktif!', res.data.message);
          setModalVisible(false);
          await loadStatus();
          await refreshProfile();
          onBoostActivated?.();
        } else {
          Alert.alert('Hata', res.data.message || 'Boost aktifleştirilemedi.');
        }
      } else {
        Alert.alert('Bilgi', 'Mağaza hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('cancel') || error?.message?.toLowerCase().includes('iptal')) return;
      Alert.alert('Hata', error.response?.data?.error?.message || error?.message || 'Boost aktifleştirilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateBoost = () => {
    // Satın alma onayı
    Alert.alert(
      'Boost Satın Al',
      `1 saatlik Boost için ₺${status?.price?.toFixed(2) || '199.99'} ödeme yapılacak.\n\nDevam etmek istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Satın Al', 
          onPress: handlePurchaseBoost,
          style: 'default',
        },
      ]
    );
  };

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.8}>
        <Animated.View 
          style={[
            styles.button,
            status?.isActive && styles.buttonActive,
            { transform: [{ scale: status?.isActive ? pulseAnim : 1 }] }
          ]}
        >
          <LinearGradient
            colors={status?.isActive 
              ? [COLORS.accent, '#00D9FF'] 
              : [COLORS.primary, COLORS.accent]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <Ionicons 
              name={status?.isActive ? 'rocket' : 'rocket-outline'} 
              size={20} 
              color="#fff" 
            />
            <View style={styles.textContainer}>
              {status?.isActive ? (
                <>
                  <Text style={styles.activeText}>Boost Aktif</Text>
                  <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
                </>
              ) : (
                <Text style={styles.buttonText}>Boost</Text>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>

      {/* Boost Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Animated.View 
                style={{
                  transform: [{
                    translateY: rocketAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -50],
                    }),
                  }],
                  opacity: rocketAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [1, 1, 0],
                  }),
                }}
              >
                <View style={styles.rocketContainer}>
                  <Ionicons name="rocket" size={56} color={COLORS.accent} />
                </View>
              </Animated.View>
              <Text style={styles.modalTitle}>Boost Al</Text>
              <Text style={styles.modalSubtitle}>
                Premium ve yüksek spark'lı kullanıcılarla{'\n'}eşleşme şansını artır!
              </Text>
            </View>

            {/* Price Card */}
            <View style={styles.priceCard}>
              <View style={styles.priceHeader}>
                <Ionicons name="time-outline" size={24} color={COLORS.accent} />
                <Text style={styles.durationText}>1 Saatlik Boost</Text>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.priceValue}>₺{status?.price?.toFixed(2) || '199.99'}</Text>
              </View>
              <Text style={styles.priceNote}>Tek seferlik ödeme</Text>
            </View>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Boost Avantajları</Text>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.benefitText}>Premium kullanıcılarla öncelikli eşleşme</Text>
              </View>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.benefitText}>Yüksek spark'lı aktif kullanıcılarla eşleş</Text>
              </View>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.benefitText}>Eşleşme ekranında özel Boost rozeti</Text>
              </View>
              <View style={styles.benefitRow}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
                <Text style={styles.benefitText}>Daha kaliteli sohbet deneyimi</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.activateButton, loading && styles.activateButtonDisabled]}
                onPress={handleActivateBoost}
                disabled={loading}
              >
                <LinearGradient
                  colors={[COLORS.accent, '#00D9FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.activateButtonGradient}
                >
                  <Ionicons name="rocket" size={20} color="#fff" />
                  <Text style={styles.activateButtonText}>
                    {loading ? 'İşleniyor...' : 'Boost Satın Al'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Active Boost Info */}
            {status?.isActive && (
              <View style={styles.activeBoostInfo}>
                <Ionicons name="information-circle" size={16} color={COLORS.accent} />
                <Text style={styles.activeBoostText}>
                  Zaten aktif bir boost'unuz var ({formatTime(timeRemaining)} kaldı). 
                  Yeni satın alma süreyi uzatır.
                </Text>
              </View>
            )}

            {/* Terms */}
            <Text style={styles.termsText}>
              Satın alarak Kullanım Koşullarını kabul etmiş olursunuz.
              {Platform.OS === 'ios' ? ' Ödeme Apple hesabınızdan tahsil edilir.' : ' Ödeme Google Play hesabınızdan tahsil edilir.'}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonActive: {
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  textContainer: {
    alignItems: 'flex-start',
  },
  buttonText: {
    ...FONTS.button,
    color: '#fff',
    fontWeight: '700',
  },
  activeText: {
    ...FONTS.caption,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  timerText: {
    ...FONTS.caption,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  rocketContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  modalSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  // Price Card
  priceCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  durationText: {
    ...FONTS.h3,
    color: COLORS.text,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.accent,
  },
  priceNote: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  // Benefits
  benefitsContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  benefitsTitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    ...FONTS.body,
    color: COLORS.text,
    flex: 1,
  },
  // Actions
  modalActions: {
    marginBottom: SPACING.md,
  },
  activateButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  activateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 4,
    gap: 10,
  },
  activateButtonDisabled: {
    opacity: 0.5,
  },
  activateButtonText: {
    ...FONTS.button,
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
  },
  // Active boost info
  activeBoostInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.accent + '15',
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: 10,
  },
  activeBoostText: {
    ...FONTS.caption,
    color: COLORS.accent,
    flex: 1,
    lineHeight: 18,
  },
  // Terms
  termsText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
});

export default BoostButton;
