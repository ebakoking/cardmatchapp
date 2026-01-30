import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';

// Jeton satın alma seçenekleri
const TOKEN_PACKAGES = [
  { tokens: 50, price: '29.90 TL' },
  { tokens: 100, price: '49.90 TL' },
  { tokens: 500, price: '199.90 TL' },
];

// Prime abonelik seçenekleri
const PRIME_PACKAGES = [
  { id: 'monthly', name: 'Aylık Prime', price: '99.90 TL', duration: '1 ay' },
  { id: 'yearly', name: 'Yıllık Prime', price: '999.90 TL', duration: '1 yıl', badge: '2 Ay Bedava!' },
];

type Props = NativeStackScreenProps<ChatStackParamList, 'HomeMain'>;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  
  // Modal states
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [primeModalVisible, setPrimeModalVisible] = useState(false);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const onMatchPress = () => {
    navigation.navigate('MatchQueue');
  };

  // Jeton satın alma
  const handleTokenPurchase = (tokens: number) => {
    Alert.alert(
      'Jeton Satın Al',
      `${tokens} jeton satın almak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: () => {
            const socket = getSocket();
            socket.emit('tokens:mock_purchase', {
              userId: user?.id,
              amount: tokens,
            });
            setTokenModalVisible(false);
            Alert.alert('Başarılı! 🎉', `${tokens} jeton hesabınıza eklendi!`);
          },
        },
      ]
    );
  };

  // Prime abonelik satın alma
  const handlePrimePurchase = (packageId: string) => {
    const pkg = PRIME_PACKAGES.find(p => p.id === packageId);
    Alert.alert(
      'Prime Abonelik',
      `${pkg?.name} (${pkg?.price}) satın almak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: () => {
            const socket = getSocket();
            socket.emit('prime:purchase', {
              userId: user?.id,
              packageId,
            });
            setPrimeModalVisible(false);
            Alert.alert('Hoş Geldiniz Prime! 👑', 'CardMatch Prime üyesi oldunuz!');
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
        <View style={styles.container}>
        <View style={styles.header}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>C</Text>
              <Text style={styles.logoAmpersand}>&</Text>
              <Text style={styles.logoText}>M</Text>
            </View>
          </View>
          <Text style={[FONTS.caption, styles.nickname]}>{user?.nickname}</Text>
        </View>

        <Animated.View
          style={[
            styles.matchButtonWrapper,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <TouchableOpacity onPress={onMatchPress} activeOpacity={0.9}>
            <LinearGradient
              colors={COLORS.gradientPrimary}
              style={styles.matchButton}
            >
              <Text style={FONTS.button}>EŞLEŞME BUL</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Eşleşme Ayarları Butonu */}
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('MatchSettings')}
          >
            <LinearGradient
              colors={COLORS.gradientPrimary}
              style={styles.settingsButtonGradient}
            >
              <Text style={styles.settingsButtonText}>
                👑 Eşleşme Ayarları 👑
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.goldButton]}
            onPress={() => setTokenModalVisible(true)}
          >
            <Text style={styles.goldButtonText}>💎 Elmas Al</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.goldButton]}
            onPress={() => setPrimeModalVisible(true)}
          >
            <Text style={styles.goldButtonText}>👑 Prime'a Geç</Text>
          </TouchableOpacity>
        </View>
        </View>

        {/* JETON SATIN ALMA MODAL */}
        <Modal
          visible={tokenModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setTokenModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>💎 Jeton Satın Al</Text>
              <Text style={styles.modalSubtitle}>Bakiyeniz: {user?.tokenBalance || 0} jeton</Text>
              
              <View style={styles.packageList}>
                {TOKEN_PACKAGES.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.tokens}
                    style={styles.packageItem}
                    onPress={() => handleTokenPurchase(pkg.tokens)}
                  >
                    <Text style={styles.packageTokens}>{pkg.tokens} 💎</Text>
                    <Text style={styles.packagePrice}>{pkg.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setTokenModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Kapat</Text>
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
            <View style={styles.modalContent}>
              <Text style={styles.primeModalTitle}>👑 CardMatch Prime</Text>
              <Text style={styles.primeSlogan}>Daha Fazla Match, Sınırsız Mesajlaşma!</Text>
              
              <View style={styles.primeFeatures}>
                <Text style={styles.primeFeature}>✅ Yaş ve Konum Filtreleme</Text>
                <Text style={styles.primeFeature}>✅ Sınırsız Sohbet (Günlük limit yok)</Text>
                <Text style={styles.primeFeature}>✅ Öne Çıkan Profil</Text>
                <Text style={styles.primeFeature}>✅ Reklamsız Deneyim</Text>
                <Text style={styles.primeFeature}>✅ Profilinde Prime Rozeti 👑</Text>
              </View>

              <View style={styles.packageList}>
                {PRIME_PACKAGES.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[styles.primePackageItem, pkg.id === 'yearly' && styles.bestValue]}
                    onPress={() => handlePrimePurchase(pkg.id)}
                  >
                    {pkg.badge && (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{pkg.badge}</Text>
                      </View>
                    )}
                    <Text style={styles.primePackageName}>{pkg.name}</Text>
                    <Text style={styles.primePackagePrice}>{pkg.price}</Text>
                    <Text style={styles.primePackageDuration}>{pkg.duration}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setPrimeModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Daha Sonra</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  container: {
    flex: 1,
    padding: SPACING.xl,
  },
  header: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: SPACING.xs,
  },
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  logoAmpersand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 2,
    opacity: 0.9,
  },
  nickname: {
    color: '#FFFFFF',
    marginTop: SPACING.xs,
  },
  matchButtonWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButton: {
    marginTop: SPACING.lg,
    borderRadius: 999,
    overflow: 'hidden',
  },
  settingsButtonGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    borderRadius: 999,
  },
  settingsButtonText: {
    ...FONTS.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  goldButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  goldButtonText: {
    ...FONTS.button,
    color: '#FFD700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
  // Prime modal styles
  primeModalTitle: {
    ...FONTS.h1,
    color: '#FFD700',
    marginBottom: SPACING.xs,
  },
  primeSlogan: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  primeFeatures: {
    alignSelf: 'flex-start',
    marginBottom: SPACING.lg,
  },
  primeFeature: {
    ...FONTS.body,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  primePackageItem: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    position: 'relative',
  },
  bestValue: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  badgeContainer: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: '#FFD700',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    ...FONTS.caption,
    color: '#000',
    fontWeight: 'bold',
  },
  primePackageName: {
    ...FONTS.h3,
    color: '#FFD700',
  },
  primePackagePrice: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  primePackageDuration: {
    ...FONTS.caption,
    color: COLORS.textSecondary,
  },
});

export default HomeScreen;

