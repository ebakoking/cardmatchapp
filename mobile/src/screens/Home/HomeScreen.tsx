import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Alert,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MATCH_BUTTON_SIZE = Math.min(SCREEN_WIDTH * 0.55, 220);
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import BoostButton from '../../components/BoostButton';
import DailyRewardModal from '../../components/DailyRewardModal';

// Elmas satın alma seçenekleri
const DIAMOND_PACKAGES = [
  { id: 'diamond_50', quantity: 50, price: '49,90 TL', isPopular: false },
  { id: 'diamond_100', quantity: 100, price: '89,90 TL', isPopular: true },
  { id: 'diamond_250', quantity: 250, price: '199,90 TL', isPopular: false },
];

// Prime abonelik seçenekleri
const PRIME_PACKAGES = [
  { 
    id: 'weekly', 
    name: 'Haftalık', 
    price: '99,90 TL', 
    duration: '7 gün',
    badge: null,
    highlight: false,
    subtext: null,
  },
  { 
    id: 'monthly', 
    name: 'Aylık', 
    price: '149,90 TL', 
    duration: '30 gün',
    badge: '⭐ En Popüler',
    highlight: true,
    subtext: null,
  },
  { 
    id: 'yearly', 
    name: 'Yıllık', 
    price: '999,90 TL', 
    duration: '12 ay',
    badge: '🏆 En Avantajlı',
    highlight: false,
    subtext: 'Aylık 83 TL\'ye denk gelir',
  },
];

type Props = NativeStackScreenProps<ChatStackParamList, 'HomeMain'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const boostGlowAnim = useRef(new Animated.Value(0.3)).current;
  
  // Modal states
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [primeModalVisible, setPrimeModalVisible] = useState(false);
  const [dailyRewardModalVisible, setDailyRewardModalVisible] = useState(false);
  const [canClaimDailyReward, setCanClaimDailyReward] = useState(false);
  
  // Boost state (API-driven)
  const [boostActive, setBoostActive] = useState(false);
  const [boostTimeLeft, setBoostTimeLeft] = useState(0); // seconds
  
  // Load boost status from API
  const loadBoostStatus = async () => {
    try {
      const res = await api.get<{ success: boolean; data: any }>('/api/boost/status');
      if (res.data.success) {
        setBoostActive(res.data.data.isActive);
        setBoostTimeLeft(res.data.data.remainingSeconds);
      }
    } catch (error) {
      console.log('Boost status check failed:', error);
    }
  };
  
  useEffect(() => {
    loadBoostStatus();
    checkDailyReward();
  }, []);

  // Check if daily reward is available
  const checkDailyReward = async () => {
    try {
      const res = await api.get('/api/daily-reward/status');
      if (res.data.success) {
        setCanClaimDailyReward(res.data.data.canClaim);
        // Auto-show modal if reward is available (optional)
        // if (res.data.data.canClaim) setDailyRewardModalVisible(true);
      }
    } catch (error) {
      console.log('Daily reward check error:', error);
    }
  };

  useEffect(() => {
    // Main button pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    // Boost glow animation
    if (boostActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(boostGlowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(boostGlowAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [boostActive, boostGlowAnim]);

  useEffect(() => {
    // Boost countdown
    if (boostActive && boostTimeLeft > 0) {
      const timer = setInterval(() => {
        setBoostTimeLeft(prev => {
          if (prev <= 1) {
            setBoostActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [boostActive, boostTimeLeft]);

  const formatBoostTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Boost activated callback
  const handleBoostActivated = () => {
    loadBoostStatus();
  };

  const handleSettingsPress = () => {
    if (user?.isPrime) {
      navigation.navigate('MatchSettings');
    } else {
      Alert.alert(
        '👑 Prime Özelliği',
        'Eşleşme ayarları Prime üyeler içindir.\n\nYaş ve konum filtreleme gibi gelişmiş özelliklere erişmek için Prime\'a geç.',
        [
          { text: 'Daha Sonra', style: 'cancel' },
          {
            text: 'Prime\'a Geç',
            onPress: () => setPrimeModalVisible(true),
          },
        ]
      );
    }
  };

  const onMatchPress = () => {
    navigation.navigate('MatchQueue');
  };

  // Elmas satın alma state
  const [purchasingPackage, setPurchasingPackage] = useState<string | null>(null);

  // Elmas satın alma
  const handleDiamondPurchase = (pkg: typeof DIAMOND_PACKAGES[0]) => {
    Alert.alert(
      'Elmas Satın Al',
      `${pkg.quantity} elmas satın almak istediğinize emin misiniz?\n\n${pkg.price}`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: async () => {
            setPurchasingPackage(pkg.id);
            try {
              // TODO: Implement real IAP purchase here
              const socket = getSocket();
              socket.emit('tokens:mock_purchase', {
                userId: user?.id,
                amount: pkg.quantity,
              });
              
              // Simulated delay for purchase
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              setTokenModalVisible(false);
              Alert.alert('Başarılı! 💎', `${pkg.quantity} elmas hesabınıza eklendi!`);
            } catch (error) {
              Alert.alert('Hata', 'Satın alma sırasında bir hata oluştu. Lütfen tekrar deneyin.');
            } finally {
              setPurchasingPackage(null);
            }
          },
        },
      ]
    );
  };

  // Prime abonelik state
  const [purchasingPrime, setPurchasingPrime] = useState<string | null>(null);

  // Prime abonelik satın alma
  const handlePrimePurchase = (pkg: typeof PRIME_PACKAGES[0]) => {
    Alert.alert(
      '👑 Prime Abonelik',
      `${pkg.name} Prime (${pkg.duration})\n\n${pkg.price}\n\nSatın almak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: async () => {
            setPurchasingPrime(pkg.id);
            try {
              // TODO: Implement real IAP purchase
              const socket = getSocket();
              socket.emit('prime:purchase', {
                userId: user?.id,
                packageId: pkg.id,
              });
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              setPrimeModalVisible(false);
              Alert.alert('Hoş Geldin Prime! 👑', 'CardMatch Prime üyesi oldun. Tüm özellikler artık aktif!');
            } catch (error) {
              Alert.alert('Hata', 'Satın alma sırasında bir hata oluştu. Lütfen tekrar deneyin.');
            } finally {
              setPurchasingPrime(null);
            }
          },
        },
      ]
    );
  };

  return (
    <LinearGradient
      colors={COLORS.gradientBackground}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Logo + Brand */}
          <View style={styles.header}>
            <Image 
              source={require('../../../assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>CardMatch</Text>
            
            {/* Daily Reward Button */}
            <TouchableOpacity 
              style={[styles.dailyRewardButton, canClaimDailyReward && styles.dailyRewardButtonActive]}
              onPress={() => setDailyRewardModalVisible(true)}
            >
              <Text style={styles.dailyRewardIcon}>🎁</Text>
              {canClaimDailyReward && <View style={styles.dailyRewardDot} />}
            </TouchableOpacity>
          </View>

          {/* Main Content Area */}
          <View style={styles.mainContent}>
            {/* Boost Button - Uses BoostButton component */}
            <View style={styles.boostButtonWrapper}>
              <BoostButton onBoostActivated={handleBoostActivated} />
            </View>

            {/* Main CTA - EŞLEŞME BUL */}
            <Animated.View
              style={[
                styles.matchButtonWrapper,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity onPress={onMatchPress} activeOpacity={0.9}>
                <LinearGradient
                  colors={COLORS.gradientPrimary}
                  style={styles.matchButton}
                >
                  <Ionicons name="shuffle" size={36} color="#FFF" style={styles.matchIcon} />
                  <Text style={styles.matchButtonText}>EŞLEŞME BUL</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.matchMicrocopy}>Kartları cevapla, sohbet aç.</Text>

            {/* Settings Link - Prime gated */}
            <TouchableOpacity 
              style={[styles.settingsLink, !user?.isPrime && styles.settingsLinkLocked]}
              onPress={handleSettingsPress}
            >
              <Ionicons 
                name={user?.isPrime ? "settings-outline" : "lock-closed"} 
                size={14} 
                color={user?.isPrime ? COLORS.textMuted : 'rgba(255, 215, 0, 0.6)'} 
              />
              <Text style={[
                styles.settingsLinkText,
                !user?.isPrime && styles.settingsLinkTextLocked
              ]}>
                Eşleşme Ayarları
              </Text>
              {!user?.isPrime && (
                <View style={styles.primeBadge}>
                  <Ionicons name="star" size={8} color="#000" />
                  <Text style={styles.primeBadgeText}>Prime</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Secondary Actions - Monetization */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setTokenModalVisible(true)}
            >
              <Ionicons name="diamond" size={16} color="#00CEC9" />
              <Text style={[styles.secondaryButtonText, { color: '#00CEC9' }]}>Elmas Al</Text>
            </TouchableOpacity>
            <View style={styles.secondaryDivider} />
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setPrimeModalVisible(true)}
            >
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={[styles.secondaryButtonText, { color: '#FFD700' }]}>Prime</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* ELMAS SATIN ALMA MODAL */}
        <Modal
          visible={tokenModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTokenModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.diamondModalContent}>
              {/* Header */}
              <View style={styles.diamondModalHeader}>
                <Ionicons name="diamond" size={32} color="#00CEC9" />
                <Text style={styles.diamondModalTitle}>Elmas Satın Al</Text>
              </View>
              <Text style={styles.diamondModalBalance}>
                Bakiyen: <Text style={styles.diamondBalanceValue}>{user?.tokenBalance || 0}</Text> elmas
              </Text>
              
              {/* Package List */}
              <View style={styles.diamondPackageList}>
                {DIAMOND_PACKAGES.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.diamondPackageItem,
                      pkg.isPopular && styles.diamondPackagePopular,
                      purchasingPackage === pkg.id && styles.diamondPackageDisabled,
                    ]}
                    onPress={() => handleDiamondPurchase(pkg)}
                    disabled={purchasingPackage !== null}
                    activeOpacity={0.7}
                  >
                    {pkg.isPopular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>EN ÇOK TERCİH EDİLEN</Text>
                      </View>
                    )}
                    <View style={styles.diamondPackageLeft}>
                      <Ionicons name="diamond" size={20} color="#00CEC9" />
                      <Text style={styles.diamondPackageQuantity}>{pkg.quantity} Elmas</Text>
                    </View>
                    <View style={styles.diamondPackageRight}>
                      {purchasingPackage === pkg.id ? (
                        <Text style={styles.diamondPackageLoading}>Satın alınıyor...</Text>
                      ) : (
                        <Text style={styles.diamondPackagePrice}>{pkg.price}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.diamondCloseButton}
                onPress={() => setTokenModalVisible(false)}
                disabled={purchasingPackage !== null}
              >
                <Text style={styles.diamondCloseButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* PRIME ABONELİK MODAL */}
        <Modal
          visible={primeModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPrimeModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.primeModalContent}>
              {/* Close Button */}
              <TouchableOpacity 
                style={styles.primeCloseIcon}
                onPress={() => setPrimeModalVisible(false)}
                disabled={purchasingPrime !== null}
              >
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>

              {/* Header */}
              <View style={styles.primeHeader}>
                <Text style={styles.primeModalTitle}>👑 CardMatch Prime</Text>
                <Text style={styles.primeSlogan}>
                  Eşleşmelerini kontrol et, sohbeti kendi hızında yaşa.
                </Text>
              </View>
              
              {/* Features */}
              <View style={styles.primeFeatures}>
                <View style={styles.primeFeatureRow}>
                  <Ionicons name="options" size={18} color="#FFD700" />
                  <Text style={styles.primeFeatureText}>Yaş & Konum & Cinsiyet Filtreleme</Text>
                </View>
                <View style={styles.primeFeatureRow}>
                  <Ionicons name="flash" size={18} color="#FFD700" />
                  <Text style={styles.primeFeatureText}>Öncelikli Eşleşme</Text>
                </View>
                <View style={styles.primeFeatureRow}>
                  <Ionicons name="eye-off" size={18} color="#FFD700" />
                  <Text style={styles.primeFeatureText}>Reklamsız Deneyim</Text>
                </View>
                <View style={styles.primeFeatureRow}>
                  <Ionicons name="star" size={18} color="#FFD700" />
                  <Text style={styles.primeFeatureText}>Prime Rozeti 👑</Text>
                </View>
              </View>

              {/* Package Cards */}
              <View style={styles.primePackageList}>
                {PRIME_PACKAGES.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.primePackageCard,
                      pkg.highlight && styles.primePackageHighlight,
                      purchasingPrime === pkg.id && styles.primePackageDisabled,
                    ]}
                    onPress={() => handlePrimePurchase(pkg)}
                    disabled={purchasingPrime !== null}
                    activeOpacity={0.7}
                  >
                    {pkg.badge && (
                      <View style={[
                        styles.primeBadgeContainer,
                        pkg.highlight && styles.primeBadgeHighlight,
                      ]}>
                        <Text style={styles.primeBadgeText}>{pkg.badge}</Text>
                      </View>
                    )}
                    <Text style={[
                      styles.primePackageName,
                      pkg.highlight && styles.primePackageNameHighlight,
                    ]}>
                      {pkg.name}
                    </Text>
                    <Text style={[
                      styles.primePackagePrice,
                      pkg.highlight && styles.primePackagePriceHighlight,
                    ]}>
                      {purchasingPrime === pkg.id ? 'Satın alınıyor...' : pkg.price}
                    </Text>
                    <Text style={styles.primePackageDuration}>{pkg.duration}</Text>
                    {pkg.subtext && (
                      <Text style={styles.primePackageSubtext}>{pkg.subtext}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Trust Microcopy */}
              <Text style={styles.primeTrustText}>
                İstediğin zaman iptal edebilirsin.
              </Text>
            </View>
          </View>
        </Modal>

        {/* Daily Reward Modal */}
        <DailyRewardModal 
          visible={dailyRewardModalVisible} 
          onClose={() => {
            setDailyRewardModalVisible(false);
            checkDailyReward(); // Refresh status
          }} 
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
    paddingBottom: SPACING.lg + 20, // Tab bar için ekstra padding
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
    width: '100%',
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: SPACING.xs,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 1,
    opacity: 0.9,
  },
  dailyRewardButton: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyRewardButtonActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  dailyRewardIcon: {
    fontSize: 24,
  },
  dailyRewardDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.danger,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Boost Button Wrapper
  boostButtonWrapper: {
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  // Boost Button - Minimal (legacy, kept for reference)
  boostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 20,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    position: 'relative',
    overflow: 'hidden',
  },
  boostButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  boostButtonText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  boostGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  boostTimer: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: SPACING.xs,
  },
  boostTimerText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '700',
  },
  // Main Match Button
  matchButtonWrapper: {
    marginVertical: SPACING.sm,
  },
  matchButton: {
    width: MATCH_BUTTON_SIZE,
    height: MATCH_BUTTON_SIZE,
    borderRadius: MATCH_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  matchIcon: {
    marginBottom: SPACING.sm,
  },
  matchButtonText: {
    ...FONTS.button,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  matchMicrocopy: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  // Settings Link
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
  },
  settingsLinkLocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  settingsLinkText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  settingsLinkTextLocked: {
    color: 'rgba(255, 215, 0, 0.7)',
  },
  primeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  primeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
  },
  // Secondary Actions
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  secondaryDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    width: '85%',
    alignItems: 'center',
  },
  // Diamond Modal styles
  diamondModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    width: '90%',
    maxWidth: 360,
  },
  diamondModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  diamondModalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  diamondModalBalance: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  diamondBalanceValue: {
    color: '#00CEC9',
    fontWeight: '700',
  },
  diamondPackageList: {
    gap: SPACING.sm,
  },
  diamondPackageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: SPACING.md,
    paddingVertical: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    overflow: 'hidden',
  },
  diamondPackagePopular: {
    borderColor: '#00CEC9',
    backgroundColor: 'rgba(0, 206, 201, 0.08)',
  },
  diamondPackageDisabled: {
    opacity: 0.6,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#00CEC9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  diamondPackageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  diamondPackageQuantity: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
  diamondPackageRight: {
    alignItems: 'flex-end',
  },
  diamondPackagePrice: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 16,
  },
  diamondPackageLoading: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  diamondCloseButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  diamondCloseButtonText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  // Legacy modal styles
  modalTitle: {
    ...FONTS.h2,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  packageList: {
    width: '100%',
    gap: SPACING.sm,
  },
  packageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
  },
  packageTokens: {
    ...FONTS.h3,
    color: COLORS.primary,
  },
  packagePrice: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  closeButtonText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
  },
  // Boost modal styles
  boostModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    width: '92%',
    maxWidth: 380,
    position: 'relative',
  },
  boostCloseIcon: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  boostHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  boostModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: SPACING.sm,
  },
  boostSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  boostModalDescription: {
    ...FONTS.body,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 22,
    fontSize: 14,
  },
  boostHowItWorks: {
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  boostHowItWorksTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFD700',
    marginBottom: SPACING.xs,
  },
  boostFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  boostFeatureText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  boostPriceContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  boostPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFD700',
  },
  boostPriceDuration: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  boostCTA: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  boostCTAGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  boostCTAText: {
    ...FONTS.button,
    color: '#000',
    fontWeight: '700',
  },
  boostSecondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  boostSecondaryText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  // Prime modal styles
  primeModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    paddingTop: SPACING.lg,
    width: '92%',
    maxWidth: 380,
    position: 'relative',
  },
  primeCloseIcon: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  primeHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.sm,
  },
  primeModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFD700',
    marginBottom: SPACING.xs,
  },
  primeSlogan: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  primeFeatures: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  primeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  primeFeatureText: {
    ...FONTS.body,
    color: COLORS.text,
    fontSize: 14,
  },
  primePackageList: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  primePackageCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    minHeight: 120,
  },
  primePackageHighlight: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    transform: [{ scale: 1.02 }],
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primePackageDisabled: {
    opacity: 0.6,
  },
  primeBadgeContainer: {
    position: 'absolute',
    top: -10,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  primeBadgeHighlight: {
    backgroundColor: '#FFD700',
  },
  primeBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  primePackageName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  primePackageNameHighlight: {
    color: '#FFD700',
  },
  primePackagePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  primePackagePriceHighlight: {
    fontSize: 18,
    color: '#FFD700',
  },
  primePackageDuration: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  primePackageSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  primeTrustText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    opacity: 0.7,
  },
});

export default HomeScreen;

