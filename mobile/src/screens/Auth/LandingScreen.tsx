import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../../theme/colors';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const LogoImage = require('../../../assets/logo.png');

type AuthStackParamList = {
  Landing: undefined;
  PhoneVerification: undefined;
  EmailAuth: undefined;
  ProfileSetup: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

// Micro-feature data
const FEATURES = [
  { 
    icon: '🔒', 
    title: 'Anonim', 
    desc: 'Fotoğrafsız başla, güvenle tanış' 
  },
  { 
    icon: '💬', 
    title: 'Chat-first', 
    desc: 'Önce sohbet, sonra karar ver' 
  },
  { 
    icon: '🎴', 
    title: 'Kademeli', 
    desc: 'Yazı → Ses → Foto → Video' 
  },
];

const LandingScreen: React.FC<Props> = ({ navigation }) => {
  const { loginWithToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [activeFeature, setActiveFeature] = useState(0);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const featureOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // CTA pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Feature rotation
    const featureInterval = setInterval(() => {
      Animated.timing(featureOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setActiveFeature(prev => (prev + 1) % FEATURES.length);
        Animated.timing(featureOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(featureInterval);
  }, []);

  // ============ AUTH HANDLERS ============
  const handleAppleSignIn = async () => {
    try {
      setLoading('apple');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const response = await api.post('/api/auth/social', {
        provider: 'apple',
        idToken: credential.identityToken || '',
        email: credential.email,
        name: credential.fullName?.givenName 
          ? `${credential.fullName.givenName} ${credential.fullName.familyName || ''}`.trim()
          : undefined,
        providerId: credential.user,
      });

      if (response.data.success) {
        const { accessToken, refreshToken, user, isProfileComplete } = response.data.data;
        await loginWithToken(accessToken, refreshToken, user);
        if (!isProfileComplete) navigation.navigate('ProfileSetup');
      }
    } catch (error: any) {
      if (error.code !== 'ERR_CANCELED') {
        Alert.alert('Hata', 'Apple ile giriş yapılamadı.');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleMainCTA = () => {
    navigation.navigate('PhoneVerification');
  };

  const currentFeature = FEATURES[activeFeature];

  return (
    <LinearGradient
      colors={COLORS.gradientBackground}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        
        {/* ========== HERO SECTION ========== */}
        <Animated.View 
          style={[
            styles.heroSection,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
            <Image 
              source={LogoImage} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          {/* Brand Name */}
          <View style={styles.brandContainer}>
            <Text style={styles.brandCard}>Card</Text>
            <Text style={styles.brandMatch}>Match</Text>
          </View>
          
          {/* Vurucu Slogan */}
          <Text style={styles.slogan}>Anonim başla, gerçek bağ kur.</Text>
          
          {/* Micro-Feature (Animated) */}
          <Animated.View style={[styles.featureCard, { opacity: featureOpacity }]}>
            <Text style={styles.featureIcon}>{currentFeature.icon}</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>{currentFeature.title}</Text>
              <Text style={styles.featureDesc}>{currentFeature.desc}</Text>
            </View>
          </Animated.View>

          {/* Feature Dots */}
          <View style={styles.featureDots}>
            {FEATURES.map((_, index) => (
              <View 
                key={index}
                style={[
                  styles.dot,
                  index === activeFeature && styles.dotActive
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* ========== CTA SECTION ========== */}
        <Animated.View 
          style={[
            styles.ctaSection,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Ana CTA Butonu */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.mainCTA}
              onPress={handleMainCTA}
              disabled={loading !== null}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mainCTAGradient}
              >
                <Text style={styles.mainCTAText}>Başla</Text>
                <Text style={styles.mainCTASubtext}>5 soru · 1 dakika</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Alternatif Giriş Seçenekleri */}
          <View style={styles.altAuthContainer}>
            <Text style={styles.altAuthLabel}>veya şununla devam et</Text>
            
            <View style={styles.altAuthRow}>
              {/* Apple (iOS only) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.altAuthButton, styles.appleButton]}
                  onPress={handleAppleSignIn}
                  disabled={loading !== null}
                  activeOpacity={0.8}
                >
                  {loading === 'apple' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="logo-apple" size={26} color="#ffffff" />
                  )}
                </TouchableOpacity>
              )}

              {/* Email */}
              <TouchableOpacity
                style={styles.altAuthButton}
                onPress={() => navigation.navigate('EmailAuth')}
                disabled={loading !== null}
                activeOpacity={0.8}
              >
                <Text style={styles.emailIcon}>✉️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* ========== FOOTER ========== */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Devam ederek{' '}
            <Text style={styles.footerLink}>Kullanım Koşulları</Text>
            {' '}ve{' '}
            <Text style={styles.footerLink}>Gizlilik Politikası</Text>
            'nı kabul edersin.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  
  // ========== HERO ==========
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandCard: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  brandMatch: {
    fontSize: 38,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  slogan: {
    fontSize: 17,
    color: COLORS.textSecondary,
    marginBottom: 32,
    fontWeight: '500',
  },
  
  // Feature Card
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    minWidth: 240,
    shadowColor: COLORS.accentDark,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 28,
  },
  featureTextContainer: {
    gap: 2,
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  featureDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 18,
  },

  // ========== CTA ==========
  ctaSection: {
    paddingBottom: 8,
  },
  mainCTA: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  mainCTAGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  mainCTAText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.background,
    letterSpacing: 0.5,
  },
  mainCTASubtext: {
    fontSize: 13,
    color: COLORS.background,
    opacity: 0.7,
    marginTop: 2,
  },
  
  // Alt Auth
  altAuthContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  altAuthLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 16,
  },
  altAuthRow: {
    flexDirection: 'row',
    gap: 16,
  },
  altAuthButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#444444',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emailIcon: {
    fontSize: 22,
  },

  // ========== FOOTER ==========
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  footerLink: {
    color: COLORS.accent,
  },
});

export default LandingScreen;
