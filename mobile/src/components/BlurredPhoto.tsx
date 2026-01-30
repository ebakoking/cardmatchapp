import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

interface BlurredPhotoProps {
  photoId: string;
  photoUrl: string;
  caption?: string;
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
  isUnlocked,
  unlockCost,
  userBalance,
  onUnlock,
  onPurchaseTokens,
  style,
}) => {
  const [unlocking, setUnlocking] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [localUnlocked, setLocalUnlocked] = useState(isUnlocked);

  const handlePress = () => {
    if (localUnlocked) {
      // Fotoğraf zaten açık - tam ekran görüntüleme yapılabilir
      return;
    }
    setShowUnlockModal(true);
  };

  const handleUnlock = async () => {
    if (userBalance < unlockCost) {
      setShowUnlockModal(false);
      Alert.alert(
        'Yetersiz Jeton',
        `Bu fotoğrafı açmak için ${unlockCost} jeton gerekiyor. Şu an ${userBalance} jetonun var.`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Jeton Satın Al', onPress: onPurchaseTokens },
        ]
      );
      return;
    }

    try {
      setUnlocking(true);
      const success = await onUnlock(photoId);
      if (success) {
        setLocalUnlocked(true);
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
        activeOpacity={localUnlocked ? 1 : 0.8}
        disabled={unlocking}
      >
        <Image source={{ uri: photoUrl }} style={styles.photo} />
        
        {/* Blur overlay */}
        {!localUnlocked && (
          <BlurView intensity={80} style={styles.blurOverlay} tint="dark">
            <View style={styles.lockContent}>
              <View style={styles.lockIconContainer}>
                <Ionicons name="lock-closed" size={28} color={COLORS.text} />
              </View>
              <View style={styles.costBadge}>
                <Ionicons name="diamond" size={14} color={COLORS.accent} />
                <Text style={styles.costText}>{unlockCost}</Text>
              </View>
              <Text style={styles.tapToUnlock}>Açmak için dokun</Text>
            </View>
          </BlurView>
        )}

        {/* Caption (sadece açık fotoğraflarda) */}
        {localUnlocked && caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText} numberOfLines={2}>
              {caption}
            </Text>
          </View>
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
              Bu fotoğrafı görmek için {unlockCost} jeton harcayacaksın.
            </Text>
            
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Bakiyen:</Text>
              <View style={styles.balanceValue}>
                <Ionicons name="diamond" size={16} color={COLORS.accent} />
                <Text style={styles.balanceText}>{userBalance}</Text>
              </View>
            </View>

            {userBalance >= unlockCost ? (
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
                      {unlockCost} Jeton ile Aç
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.insufficientBadge}>
                  <Text style={styles.insufficientText}>
                    {unlockCost - userBalance} jeton daha gerekli
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
                  <Text style={styles.purchaseButtonText}>Jeton Satın Al</Text>
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
  lockContent: {
    alignItems: 'center',
    gap: SPACING.sm,
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
});

export default BlurredPhoto;
