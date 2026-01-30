import React, { useState, useEffect } from 'react';
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
} from 'react-native';
// expo-screen-capture Expo Go'da desteklenmiyor, production build'de aktif edilecek
// import * as ScreenCapture from 'expo-screen-capture';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  onViewed?: (messageId: string, mediaType: 'photo' | 'video') => void; // Fotoğraf görüntülendiğinde (ephemeral için)
  imageUrl: string;
  messageId: string;
  mediaType?: 'photo' | 'video';
  isMine: boolean;
  isFirstFreeView: boolean; // İlk ücretsiz hak
  tokenCost: number;
  userTokenBalance: number;
  onViewWithTokens: (messageId: string) => Promise<boolean>;
  onRequestTokens: () => void;
  onPurchaseTokens?: () => void; // Satın alma ekranına yönlendirme
  senderNickname: string;
  isInstantPhoto: boolean; // Anlık mı galeri mi
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
  tokenCost,
  userTokenBalance,
  onViewWithTokens,
  onRequestTokens,
  onPurchaseTokens,
  senderNickname,
  isInstantPhoto,
}) => {
  const [isViewing, setIsViewing] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [viewTimer, setViewTimer] = useState(10); // 10 saniye görüntüleme süresi
  const [loading, setLoading] = useState(false);

  // İLK MEDYA İÇİN: Modal açıldığında direkt fotoğrafı göster (kilit ekranı YOK)
  useEffect(() => {
    if (visible) {
      // Kendi fotoğrafı veya ilk ücretsiz görüntüleme ise direkt aç
      if (isMine || isFirstFreeView) {
        console.log('[PhotoViewModal] Auto-unlock: isMine=', isMine, 'isFirstFreeView=', isFirstFreeView);
        setIsUnlocked(true);
        setIsViewing(true);
      } else {
        // Başkasının fotoğrafı ve ücretsiz hak yok - kilit ekranı göster
        setIsUnlocked(false);
        setIsViewing(false);
      }
    } else {
      // Modal kapandığında reset
      setIsUnlocked(false);
      setIsViewing(false);
      setViewTimer(10);
    }
  }, [visible, isMine, isFirstFreeView]);

  // Ekran görüntüsü engelleme - Production build'de aktif edilecek
  // expo-screen-capture Expo Go'da çalışmıyor
  useEffect(() => {
    if (visible && !isMine) {
      console.log('[PhotoViewModal] Screen capture prevention would be enabled in production');
    }
  }, [visible, isMine]);

  // Timer KALDIRILDI - Kullanıcı istediği kadar bakabilir, kapattığında "görüntülendi" olur
  // useEffect(() => {
  //   let interval: NodeJS.Timeout;
  //   if (isViewing && viewTimer > 0) {
  //     interval = setInterval(() => {
  //       setViewTimer((t) => {
  //         if (t <= 1) {
  //           handleClose();
  //           return 0;
  //         }
  //         return t - 1;
  //       });
  //     }, 1000);
  //   }
  //   return () => clearInterval(interval);
  // }, [isViewing, viewTimer]);

  const handleClose = () => {
    // Eğer fotoğraf görüntülendiyse (kendi değilse) ephemeral olarak işaretle
    if (isUnlocked && !isMine) {
      console.log('[PhotoViewModal] Media was viewed, marking as ephemeral:', messageId);
      onViewed?.(messageId, mediaType);
    }
    setIsViewing(false);
    setIsUnlocked(false);
    setViewTimer(10);
    onClose();
  };

  const handleViewPhoto = async () => {
    // Kendi fotoğrafımız ise direkt göster
    if (isMine) {
      setIsUnlocked(true);
      setIsViewing(true);
      return;
    }

    // İlk ücretsiz hak varsa kullan
    if (isFirstFreeView) {
      setIsUnlocked(true);
      setIsViewing(true);
      return;
    }

    // Jeton kontrolü - YETERSİZSE ASLA AÇMA
    if (userTokenBalance < tokenCost) {
      Alert.alert(
        'Yetersiz Jeton',
        `Bu fotoğrafı görmek için ${tokenCost} jeton gerekiyor.\nBakiyeniz: ${userTokenBalance}`,
        [
          { text: 'İptal', style: 'cancel', onPress: onClose },
          { 
            text: 'Jeton Satın Al', 
            onPress: () => {
              onClose();
              onPurchaseTokens?.();
            } 
          },
        ],
      );
      // Bakiye yetersiz - fotoğrafı ASLA açma
      return;
    }

    // Token harca
    setLoading(true);
    const success = await onViewWithTokens(messageId);
    setLoading(false);

    if (success) {
      setIsUnlocked(true);
      setIsViewing(true);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Kapatma butonu */}
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {isViewing && isUnlocked ? (
          // Fotoğraf görüntüleniyor
          <View style={styles.viewingContainer}>
            {/* Timer KALDIRILDI - Kullanıcı kapattığında "görüntülendi" olur */}

            {/* Tip bilgisi */}
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>
                {isInstantPhoto ? '📷 Anlık Fotoğraf' : '🖼️ Galeri Fotoğrafı'}
              </Text>
            </View>

            {/* Fotoğraf */}
            <Image
              source={{ uri: imageUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />

            {/* Uyarı */}
            <Text style={styles.warningText}>
              Ekran görüntüsü almak yasaktır
            </Text>
          </View>
        ) : (
          // Kilit ekranı
          <View style={styles.lockContainer}>
            {/* Blur preview */}
            <Image
              source={{ uri: imageUrl }}
              style={styles.blurImage}
              blurRadius={30}
            />

            <View style={styles.lockOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockTitle}>
                {senderNickname} fotoğraf gönderdi
              </Text>
              <Text style={styles.lockSubtitle}>
                {isInstantPhoto ? 'Anlık fotoğraf' : 'Galeri fotoğrafı'}
              </Text>

              {isMine ? (
                <TouchableOpacity style={styles.viewButton} onPress={handleViewPhoto}>
                  <Text style={styles.viewButtonText}>Görüntüle</Text>
                </TouchableOpacity>
              ) : isFirstFreeView ? (
                <TouchableOpacity style={styles.freeButton} onPress={handleViewPhoto}>
                  <Text style={styles.freeButtonText}>✨ Ücretsiz Aç</Text>
                  <Text style={styles.freeNote}>İlk fotoğraf ücretsiz!</Text>
                </TouchableOpacity>
              ) : loading ? (
                <ActivityIndicator color={COLORS.primary} size="large" />
              ) : (
                <View style={styles.tokenSection}>
                  <Text style={styles.tokenInfo}>
                    Görmek için {tokenCost} jeton gerekiyor
                  </Text>
                  <Text style={styles.balanceInfo}>
                    Bakiyeniz: {userTokenBalance} jeton
                  </Text>
                  
                  {userTokenBalance >= tokenCost ? (
                    <TouchableOpacity style={styles.payButton} onPress={handleViewPhoto}>
                      <Text style={styles.payButtonText}>
                        🔓 Aç ({tokenCost} jeton)
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.insufficientContainer}>
                      <Text style={styles.insufficientText}>
                        ⚠️ {tokenCost - userTokenBalance} jeton daha gerekiyor
                      </Text>
                      
                      {onPurchaseTokens && (
                        <TouchableOpacity style={styles.purchaseButton} onPress={onPurchaseTokens}>
                          <Text style={styles.purchaseButtonText}>
                            💰 Jeton Satın Al
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      <TouchableOpacity style={styles.requestButton} onPress={onRequestTokens}>
                        <Text style={styles.requestButtonText}>
                          💝 Jeton İste
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}
      </View>
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: COLORS.text,
    fontSize: 20,
  },
  // Görüntüleme durumu
  viewingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  timerBadge: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  timerText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  typeBadge: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  typeText: {
    color: COLORS.text,
    fontSize: 12,
  },
  fullImage: {
    width: width - 40,
    height: height * 0.7,
  },
  warningText: {
    position: 'absolute',
    bottom: 50,
    color: COLORS.error,
    fontSize: 12,
  },
  // Kilit durumu
  lockContainer: {
    width: width - 60,
    height: height * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  lockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  lockTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  lockSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  viewButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  viewButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  freeButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    alignItems: 'center',
  },
  freeButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  freeNote: {
    color: COLORS.text,
    fontSize: 10,
    marginTop: 4,
  },
  tokenSection: {
    alignItems: 'center',
  },
  tokenInfo: {
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  balanceInfo: {
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  payButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  payButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  insufficientContainer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  insufficientText: {
    color: COLORS.error,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  purchaseButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  purchaseButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  requestButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  requestButtonText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
});

export default PhotoViewModal;
