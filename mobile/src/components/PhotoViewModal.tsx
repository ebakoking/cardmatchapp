import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenCapture from 'expo-screen-capture';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';

const { width, height } = Dimensions.get('window');

// Görüntüleme süresi (saniye)
const VIEW_DURATION = 10;

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
  const [countdown, setCountdown] = useState(VIEW_DURATION);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // Screenshot koruması
  useEffect(() => {
    if (isViewing && isUnlocked && !isMine) {
      // Ekran görüntüsünü engelle
      ScreenCapture.preventScreenCaptureAsync();
      return () => {
        ScreenCapture.allowScreenCaptureAsync();
      };
    }
  }, [isViewing, isUnlocked, isMine]);

  // Modal açılınca
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      setCountdown(VIEW_DURATION);
      progressAnim.setValue(1);
      
      // Kendi fotoğrafımsa direkt aç
      if (isMine) {
        setIsUnlocked(true);
        setIsViewing(true);
      } else {
        setIsUnlocked(false);
        setIsViewing(false);
      }
    } else {
      fadeAnim.setValue(0);
      setIsUnlocked(false);
      setIsViewing(false);
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    }
  }, [visible, isMine]);

  // Countdown başlat
  useEffect(() => {
    if (isViewing && isUnlocked && !isMine) {
      // Progress bar animasyonu
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: VIEW_DURATION * 1000,
        useNativeDriver: false,
      }).start();

      // Countdown sayacı
      countdownInterval.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            handleAutoClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      };
    }
  }, [isViewing, isUnlocked, isMine]);

  const handleAutoClose = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    handleClose();
  };

  const handleClose = () => {
    if (isUnlocked && !isMine) {
      onViewed?.(messageId, mediaType);
    }
    
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
    }
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setIsViewing(false);
      setIsUnlocked(false);
      onClose();
    });
  };

  const handleViewPhoto = async () => {
    // Kendi medyamsa direkt aç
    if (isMine) {
      setIsUnlocked(true);
      setIsViewing(true);
      return;
    }

    // Ücretli medya - bakiye kontrolü
    if (!isFirstFreeView && userElmasBalance < elmasCost) {
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

    setLoading(true);
    const success = await onViewWithElmas(messageId);
    setLoading(false);

    if (success) {
      setIsUnlocked(true);
      setIsViewing(true);
      setCountdown(VIEW_DURATION);
    }
  };

  // Progress bar genişliği
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar hidden={isViewing && isUnlocked} />
      
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {isViewing && isUnlocked ? (
          // ===== TAM EKRAN GÖRÜNTÜLEME (Snapchat tarzı) =====
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={styles.fullscreenContainer}>
              {/* Progress Bar (üstte) */}
              {!isMine && (
                <View style={styles.progressContainer}>
                  <Animated.View 
                    style={[
                      styles.progressBar, 
                      { width: progressWidth }
                    ]} 
                  />
                </View>
              )}

              {/* Kalan süre (sol üst) - Anonimlik için nick yok */}
              {!isMine && (
                <View style={styles.senderBadge}>
                  <View style={styles.senderAvatar}>
                    <Ionicons name="time" size={16} color="#fff" />
                  </View>
                  <Text style={styles.countdownText}>{countdown} saniye</Text>
                </View>
              )}

              {/* Medya (tam ekran) */}
              {imageUrl && imageUrl.length > 0 ? (
                mediaType === 'video' ? (
                  <Video
                    source={{ uri: imageUrl }}
                    style={styles.fullscreenMedia}
                    useNativeControls={false}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                    isLooping={false}
                    onPlaybackStatusUpdate={(status) => {
                      if (status.isLoaded && status.didJustFinish) {
                        handleClose();
                      }
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.fullscreenMedia}
                    resizeMode="contain"
                  />
                )
              ) : (
                <View style={[styles.fullscreenMedia, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="image-outline" size={48} color="#666" />
                  <Text style={{ color: '#666', marginTop: 8 }}>Yükleniyor...</Text>
                </View>
              )}

              {/* Kapatmak için dokun yazısı (alt) */}
              <View style={styles.tapToCloseContainer}>
                <Text style={styles.tapToCloseText}>Kapatmak için dokun</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        ) : (
          // ===== KİLİT EKRANI =====
          <>
            {/* Kapatma butonu */}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={24} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.lockContainer}>
              {/* Blur preview */}
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.blurImage}
                  blurRadius={40}
                />
              ) : (
                <View style={[styles.blurImage, { backgroundColor: '#333' }]} />
              )}

              <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
                style={styles.lockOverlay}
              >
                {/* Kilit ikonu */}
                <View style={styles.lockIconContainer}>
                  <Ionicons 
                    name={mediaType === 'video' ? 'videocam' : 'camera'} 
                    size={32} 
                    color="#fff" 
                  />
                </View>
                
                <Text style={styles.lockTitle}>
                  {mediaType === 'video' ? 'Video' : (isInstantPhoto ? 'Anlık Fotoğraf' : 'Fotoğraf')}
                </Text>
                
                <Text style={styles.lockSubtitle}>
                  Görüntülemek için dokunun
                </Text>

                {/* Tek görüntüleme uyarısı */}
                {!isMine && (
                  <View style={styles.ephemeralBadge}>
                    <Ionicons name="time-outline" size={14} color="#ffd700" />
                    <Text style={styles.ephemeralText}>Tek seferlik görüntüleme</Text>
                  </View>
                )}

                {/* Butonlar */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="#fff" size="large" />
                  </View>
                ) : isMine ? (
                  <TouchableOpacity style={styles.viewButton} onPress={handleViewPhoto}>
                    <Ionicons name="eye" size={20} color="#000" />
                    <Text style={styles.viewButtonText}>Görüntüle</Text>
                  </TouchableOpacity>
                ) : isFirstFreeView ? (
                  <TouchableOpacity style={styles.freeButton} onPress={handleViewPhoto}>
                    <Ionicons name="sparkles" size={20} color="#000" />
                    <Text style={styles.freeButtonText}>Ücretsiz Aç</Text>
                  </TouchableOpacity>
                ) : userElmasBalance >= elmasCost ? (
                  <TouchableOpacity style={styles.payButton} onPress={handleViewPhoto}>
                    <Ionicons name="diamond" size={18} color="#000" />
                    <Text style={styles.payButtonText}>{elmasCost} Elmas ile Aç</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.insufficientContainer}>
                    <Text style={styles.insufficientText}>
                      {elmasCost} elmas gerekiyor (Bakiye: {userElmasBalance})
                    </Text>
                    <TouchableOpacity 
                      style={styles.purchaseButton} 
                      onPress={() => {
                        handleClose();
                        onPurchaseElmas?.();
                      }}
                    >
                      <Ionicons name="diamond" size={18} color="#fff" />
                      <Text style={styles.purchaseButtonText}>Elmas Satın Al</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </LinearGradient>
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // ===== TAM EKRAN GÖRÜNTÜLEME =====
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    zIndex: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  senderBadge: {
    position: 'absolute',
    top: 65,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    gap: 8,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  countdownText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  fullscreenMedia: {
    flex: 1,
    width: width,
    height: height,
  },
  tapToCloseContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapToCloseText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },

  // ===== KİLİT EKRANI =====
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  lockSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 16,
  },
  ephemeralBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 24,
  },
  ephemeralText: {
    color: '#ffd700',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    marginTop: 20,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  viewButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  freeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D26A',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  freeButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
  },
  payButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  insufficientContainer: {
    alignItems: 'center',
    gap: 12,
  },
  insufficientText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  purchaseButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export default PhotoViewModal;
