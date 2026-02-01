import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onViewed?: (messageId: string, mediaType: 'photo' | 'video') => void;
  imageUrl: string;
  messageId: string;
  mediaType?: 'photo' | 'video';
  isMine: boolean;
  isFirstFreeView: boolean;
  elmasCost: number;
  userElmasBalance: number;
  onViewWithElmas: (messageId: string) => Promise<boolean>;
  onRequestElmas: () => void;
  onPurchaseElmas?: () => void;
  senderNickname: string;
  isInstantPhoto: boolean;
}

const PhotoViewModal: React.FC<Props> = ({
  visible,
  onClose,
  onViewed,
  imageUrl,
  messageId,
  mediaType = 'photo',
  isMine,
  isFirstFreeView,
  elmasCost,
  userElmasBalance,
  onViewWithElmas,
  onRequestElmas,
  onPurchaseElmas,
  senderNickname,
  isInstantPhoto,
}) => {
  const [isViewing, setIsViewing] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Her zaman kilit ekranı göster - kullanıcı butona basmalı
      // Auto-unlock kaldırıldı çünkü race condition yaratıyordu
      setIsUnlocked(false);
      setIsViewing(false);
      console.log('[PhotoViewModal] Modal opened, showing lock screen. isMine=', isMine, 'isFirstFreeView=', isFirstFreeView);
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      setIsUnlocked(false);
      setIsViewing(false);
    }
  }, [visible, isMine, isFirstFreeView]);

  const handleClose = () => {
    if (isUnlocked && !isMine) {
      console.log('[PhotoViewModal] Media was viewed, marking as ephemeral:', messageId);
      onViewed?.(messageId, mediaType);
    }
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsViewing(false);
      setIsUnlocked(false);
      onClose();
    });
  };

  const handleViewPhoto = async () => {
    console.log('===== PhotoViewModal handleViewPhoto START =====');
    console.log('isMine:', isMine);
    console.log('isFirstFreeView:', isFirstFreeView);
    console.log('userElmasBalance:', userElmasBalance);
    console.log('elmasCost:', elmasCost);
    console.log('messageId:', messageId);
    
    // Kendi medyamsa direkt aç
    if (isMine) {
      console.log('CASE: My own photo - opening for free');
      setIsUnlocked(true);
      setIsViewing(true);
      return;
    }

    // İlk ücretsiz ise bakiye kontrolü yapma
    if (!isFirstFreeView) {
      // Ücretli medya - bakiye kontrolü
      if (userElmasBalance < elmasCost) {
        console.log('ERROR: Insufficient balance:', userElmasBalance, '<', elmasCost);
        Alert.alert(
          'Yetersiz Elmas',
          `Bu ${mediaType === 'photo' ? 'fotoğrafı' : 'videoyu'} görmek için ${elmasCost} elmas gerekiyor.\nBakiyeniz: ${userElmasBalance}`,
          [
            { text: 'İptal', style: 'cancel', onPress: handleClose },
            { 
              text: 'Elmas Satın Al', 
              onPress: () => {
                handleClose();
                onPurchaseElmas?.();
              } 
            },
          ],
        );
        return;
      }
    }

    // Socket ile unlock çağır (server ücretsiz/ücretli kararı verecek)
    console.log('Calling onViewWithElmas (socket)...');
    setLoading(true);
    const success = await onViewWithElmas(messageId);
    console.log('onViewWithElmas returned:', success);
    setLoading(false);

    if (success) {
      console.log('SUCCESS - Unlocking photo');
      setIsUnlocked(true);
      setIsViewing(true);
    } else {
      console.log('FAILED - Could not unlock photo');
    }
    console.log('===== PhotoViewModal handleViewPhoto END =====');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {/* Kapatma butonu */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <View style={styles.closeButtonInner}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </View>
        </TouchableOpacity>

        {isViewing && isUnlocked ? (
          // Medya görüntüleniyor (fotoğraf veya video)
          <Animated.View 
            style={[
              styles.viewingContainer,
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            {/* Tip bilgisi */}
            <View style={styles.typeBadge}>
              <Ionicons 
                name={mediaType === 'video' ? 'videocam' : (isInstantPhoto ? 'camera' : 'image')} 
                size={14} 
                color={COLORS.text} 
              />
              <Text style={styles.typeText}>
                {mediaType === 'video' 
                  ? 'Video' 
                  : (isInstantPhoto ? 'Anlık Fotoğraf' : 'Galeri Fotoğrafı')}
              </Text>
            </View>

            {/* Video veya Fotoğraf */}
            {mediaType === 'video' ? (
              imageUrl ? (
                <Video
                  source={{ uri: imageUrl }}
                  style={styles.fullVideo}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping={false}
                />
              ) : (
                <View style={[styles.fullVideo, { backgroundColor: '#333' }]} />
              )
            ) : (
              imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.fullImage, { backgroundColor: '#333' }]} />
              )
            )}

            {/* Gönderen bilgisi */}
            <View style={styles.senderInfo}>
              <Ionicons name="person-circle" size={20} color={COLORS.textMuted} />
              <Text style={styles.senderText}>{senderNickname}</Text>
            </View>

            {/* Uyarı */}
            <View style={styles.warningContainer}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.warning} />
              <Text style={styles.warningText}>
                Ekran görüntüsü koruması aktif
              </Text>
            </View>
          </Animated.View>
        ) : (
          // Kilit ekranı
          <Animated.View 
            style={[
              styles.lockContainer,
              { transform: [{ scale: scaleAnim }] }
            ]}
          >
            {/* Blur preview */}
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.blurImage}
                blurRadius={30}
              />
            ) : (
              <View style={[styles.blurImage, { backgroundColor: '#333' }]} />
            )}

            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
              style={styles.lockOverlay}
            >
              <View style={styles.lockIconContainer}>
                <Ionicons name="lock-closed" size={36} color={COLORS.text} />
              </View>
              
              <Text style={styles.lockTitle}>
                {senderNickname} {mediaType === 'photo' ? 'fotoğraf' : 'video'} gönderdi
              </Text>
              
              <View style={styles.lockTypeBadge}>
                <Ionicons 
                  name={mediaType === 'video' ? 'videocam' : (isInstantPhoto ? 'camera' : 'image')} 
                  size={12} 
                  color={COLORS.textSecondary} 
                />
                <Text style={styles.lockTypeText}>
                  {mediaType === 'video' ? 'Video' : (isInstantPhoto ? 'Anlık' : 'Galeri')}
                </Text>
              </View>

              {isMine ? (
                <TouchableOpacity style={styles.viewButton} onPress={handleViewPhoto}>
                  <Ionicons name="eye" size={18} color={COLORS.text} />
                  <Text style={styles.viewButtonText}>Görüntüle</Text>
                </TouchableOpacity>
              ) : isFirstFreeView ? (
                <TouchableOpacity style={styles.freeButton} onPress={handleViewPhoto}>
                  <LinearGradient
                    colors={[COLORS.success, '#27ae60']}
                    style={styles.freeButtonGradient}
                  >
                    <Ionicons name="sparkles" size={18} color={COLORS.text} />
                    <Text style={styles.freeButtonText}>Ücretsiz Aç</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={COLORS.accent} size="large" />
                  <Text style={styles.loadingText}>Açılıyor...</Text>
                </View>
              ) : (
                <View style={styles.tokenSection}>
                  <View style={styles.tokenInfoRow}>
                    <Ionicons name="diamond" size={16} color={COLORS.accent} />
                    <Text style={styles.tokenInfoText}>
                      {elmasCost} elmas gerekiyor
                    </Text>
                  </View>
                  
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceLabel}>Bakiyeniz:</Text>
                    <Text style={[
                      styles.balanceValue,
                      userElmasBalance < elmasCost && styles.balanceInsufficient
                    ]}>
                      {userElmasBalance} elmas
                    </Text>
                  </View>
                  
                  {userElmasBalance >= elmasCost ? (
                    <TouchableOpacity style={styles.payButton} onPress={handleViewPhoto}>
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.primaryDark]}
                        style={styles.payButtonGradient}
                      >
                        <Ionicons name="lock-open" size={18} color={COLORS.text} />
                        <Text style={styles.payButtonText}>
                          Aç ({elmasCost} elmas)
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.insufficientContainer}>
                      <View style={styles.insufficientBadge}>
                        <Ionicons name="alert-circle" size={14} color={COLORS.error} />
                        <Text style={styles.insufficientText}>
                          {elmasCost - userElmasBalance} elmas daha gerekiyor
                        </Text>
                      </View>
                      
                      {onPurchaseElmas && (
                        <TouchableOpacity 
                          style={styles.purchaseButton} 
                          onPress={() => {
                            handleClose();
                            onPurchaseElmas();
                          }}
                        >
                          <LinearGradient
                            colors={[COLORS.accent, COLORS.accentDark]}
                            style={styles.purchaseButtonGradient}
                          >
                            <Ionicons name="diamond" size={16} color={COLORS.background} />
                            <Text style={styles.purchaseButtonText}>Elmas Satın Al</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity style={styles.requestButton} onPress={onRequestElmas}>
                        <Ionicons name="gift" size={16} color={COLORS.accent} />
                        <Text style={styles.requestButtonText}>Elmas İste</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Görüntüleme durumu
  viewingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  typeBadge: {
    position: 'absolute',
    top: 60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    gap: 6,
  },
  typeText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '500',
  },
  fullImage: {
    width: width - 40,
    height: height * 0.65,
  },
  fullVideo: {
    width: width - 40,
    height: height * 0.65,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  senderInfo: {
    position: 'absolute',
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  warningContainer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningText: {
    color: COLORS.warning,
    fontSize: 11,
  },
  // Kilit durumu
  lockContainer: {
    width: width - 60,
    height: height * 0.55,
    borderRadius: 24,
    overflow: 'hidden',
  },
  blurImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  lockIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  lockTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.xl,
  },
  lockTypeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    gap: 8,
  },
  viewButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  freeButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  freeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: 8,
  },
  freeButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  tokenSection: {
    alignItems: 'center',
    width: '100%',
  },
  tokenInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  tokenInfoText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.lg,
  },
  balanceLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  balanceValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  balanceInsufficient: {
    color: COLORS.error,
  },
  payButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '80%',
  },
  payButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 8,
  },
  payButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 15,
  },
  insufficientContainer: {
    alignItems: 'center',
    width: '100%',
    gap: SPACING.md,
  },
  insufficientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  insufficientText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '500',
  },
  purchaseButton: {
    borderRadius: 25,
    overflow: 'hidden',
    width: '80%',
  },
  purchaseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 8,
  },
  purchaseButtonText: {
    color: COLORS.background,
    fontWeight: '600',
    fontSize: 15,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  requestButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PhotoViewModal;
