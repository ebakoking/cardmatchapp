import React, { useState, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

// expo-blur için güvenli import - yoksa fallback kullanılır
let BlurView: any = null;
try {
  BlurView = require('expo-blur').BlurView;
} catch (e) {
  // expo-blur yüklenemedi, fallback kullanılacak
  console.log('expo-blur not available, using fallback overlay');
}

// Fallback blur overlay (expo-blur yoksa veya çalışmazsa)
const FallbackBlurOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.fallbackBlur}>
    {children}
  </View>
);

interface BlurredPhotoProps {
  photoId: string;
  photoUrl: string;
  caption?: string;
  hasCaption?: boolean; // Server tells us if there's a caption without revealing content
  isUnlocked: boolean;
  unlockCost: number;
  userBalance: number;
  onUnlock: (photoId: string) => Promise<boolean>;
  onPurchaseTokens: () => void;
  style?: any;
}

const BlurredPhoto: React.FC<BlurredPhotoProps> = ({
  photoId,
  photoUrl,
  caption,
  hasCaption,
  isUnlocked,
  unlockCost = 5, // Default 5 elmas
  userBalance = 0,
  onUnlock,
  onPurchaseTokens,
  style,
}) => {
  // NaN koruması
  const safeCost = Number.isNaN(unlockCost) ? 5 : unlockCost;
  const safeBalance = Number.isNaN(userBalance) ? 0 : userBalance;
  const [unlocking, setUnlocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);

  const handlePress = () => {
    if (isUnlocked) {
      // Fotoğraf açık - tam ekran görüntüleme
      setShowFullscreenModal(true);
      return;
    }
    setShowUnlockModal(true);
  };

  const handleUnlock = async () => {
    if (safeBalance < safeCost) {
      setShowUnlockModal(false);
      Alert.alert(
        'Yetersiz Elmas',
        `Bu fotoğrafı açmak için ${safeCost} elmas gerekiyor. Şu an ${safeBalance} elmasın var.`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Elmas Satın Al', onPress: onPurchaseTokens },
        ]
      );
      return;
    }

    try {
      setUnlocking(true);
      const success = await onUnlock(photoId);
      if (success) {
        // Parent component will update isUnlocked prop
        setShowFullscreenModal(true); // Hemen tam ekran göster
      }
    } finally {
      setUnlocking(false);
      setShowUnlockModal(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={handlePress}
        activeOpacity={isUnlocked ? 1 : 0.8}
        disabled={unlocking}
      >
        {/* KİLİTLİ: Fotoğrafı hiç yükleme/gösterme - sadece placeholder */}
        {!isUnlocked ? (
          <View style={styles.lockedPlaceholder}>
            <View style={styles.lockContent}>
              {/* İkon container - relative position için wrapper */}
              <View style={styles.iconWrapper}>
                <View style={styles.lockIconContainer}>
                  <Ionicons name="image" size={32} color={COLORS.textMuted} />
                </View>
                <View style={styles.lockIconSmall}>
                  <Ionicons name="lock-closed" size={14} color={COLORS.text} />
                </View>
              </View>
              <View style={styles.costBadge}>
                <Ionicons name="diamond" size={14} color={COLORS.accent} />
                <Text style={styles.costText}>{safeCost}</Text>
              </View>
              <Text style={styles.tapToUnlock}>Açmak için dokun</Text>
              {/* Caption indicator when locked */}
              {hasCaption && (
                <View style={styles.lockedCaptionHint}>
                  <Ionicons name="chatbubble-ellipses" size={12} color={COLORS.textMuted} />
                  <Text style={styles.lockedCaptionText}>Açıklama var</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          /* AÇIK: Gerçek fotoğrafı göster */
          <>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, { backgroundColor: '#333' }]} />
            )}
            
            {/* Caption (sadece açık fotoğraflarda - küçük görünüm) */}
            {caption && (
              <View style={styles.captionContainer}>
                <Text style={styles.captionText} numberOfLines={2}>
                  {caption}
                </Text>
              </View>
            )}
            
            {/* Açık fotoğraf ikonu */}
            <View style={styles.unlockedBadge}>
              <Ionicons name="expand" size={16} color={COLORS.text} />
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Unlock Modal */}
      <Modal
        visible={showUnlockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnlockModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnlockModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="image" size={40} color={COLORS.accent} />
            </View>
            
            <Text style={styles.modalTitle}>Fotoğrafı Aç</Text>
            <Text style={styles.modalDescription}>
              Bu fotoğrafı görmek için {safeCost} elmas harcayacaksın.
            </Text>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Bakiyen:</Text>
              <View style={styles.balanceValue}>
                <Ionicons name="diamond" size={16} color={COLORS.accent} />
                <Text style={styles.balanceText}>{safeBalance}</Text>
              </View>
            </View>

            {safeBalance >= safeCost ? (
              <TouchableOpacity
                style={styles.unlockButton}
                onPress={handleUnlock}
                disabled={unlocking}
              >
                {unlocking ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons name="lock-open" size={18} color={COLORS.background} />
                    <Text style={styles.unlockButtonText}>
                      {safeCost} Elmas ile Aç
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.insufficientBadge}>
                  <Text style={styles.insufficientText}>
                    {safeCost - safeBalance} elmas daha gerekli
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.purchaseButton}
                  onPress={() => {
                    setShowUnlockModal(false);
                    onPurchaseTokens();
                  }}
                >
                  <Ionicons name="add-circle" size={18} color={COLORS.text} />
                  <Text style={styles.purchaseButtonText}>Elmas Satın Al</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowUnlockModal(false)}
            >
              <Text style={styles.cancelButtonText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Photo Modal (açılmış fotoğraflar için) */}
      <Modal
        visible={showFullscreenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFullscreenModal(false)}
      >
        <View style={styles.fullscreenOverlay}>
          {/* Kapat butonu */}
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => setShowFullscreenModal(false)}
          >
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>

          {/* Büyük fotoğraf */}
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.fullscreenPhoto}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.fullscreenPhoto, { backgroundColor: '#333' }]} />
          )}

          {/* Caption (varsa) */}
          {caption && (
            <View style={styles.fullscreenCaptionContainer}>
              <Text style={styles.fullscreenCaptionText}>{caption}</Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  photo: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 35, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Kilitli fotoğraf placeholder - fotoğrafı hiç yüklemeden gösterilir
  lockedPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    // Gradient efekt için
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  lockIconSmall: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  lockIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  costText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  tapToUnlock: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  lockedCaptionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: 4,
    opacity: 0.7,
  },
  lockedCaptionText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: SPACING.sm,
  },
  captionText: {
    color: COLORS.text,
    fontSize: 13,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 206, 201, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalDescription: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  balanceLabel: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  balanceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    gap: SPACING.sm,
    width: '100%',
  },
  unlockButtonText: {
    ...FONTS.button,
    color: COLORS.background,
  },
  insufficientBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.md,
  },
  insufficientText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    gap: SPACING.sm,
    width: '100%',
  },
  purchaseButtonText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  cancelButton: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  cancelButtonText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  // Açılmış fotoğraf badge
  unlockedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Fullscreen modal styles
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenPhoto: {
    width: '100%',
    height: '70%',
  },
  fullscreenCaptionContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 80 : 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.md,
    borderRadius: 12,
  },
  fullscreenCaptionText: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default BlurredPhoto;
