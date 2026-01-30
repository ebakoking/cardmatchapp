import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';
import AudioMessage from './AudioMessage';

interface Props {
  message: {
    id: string;
    senderId?: string;
    content?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    messageType?: 'TEXT' | 'MEDIA' | 'TOKEN_GIFT' | 'SYSTEM'; // YENİ: Message type
    tokenAmount?: number; // TOKEN_GIFT için miktar
    senderNickname?: string; // TOKEN_GIFT için gönderen adı
    receiverNickname?: string; // TOKEN_GIFT için alıcı adı
    isInstant?: boolean; // Anlık mı galeri mi
    isViewed?: boolean; // Görüntülendi mi
    duration?: number; // Ses süresi (saniye)
    createdAt?: string; // Zaman damgası
    // Sistem mesajı için (eski format - geriye uyumluluk)
    isSystem?: boolean;
    systemType?: 'gift' | 'stage' | 'info' | 'friend';
    systemData?: {
      fromNickname?: string;
      amount?: number;
      newStage?: number;
    };
  };
  isMine: boolean;
  onMediaPress?: (message: any) => void; // Medyaya tıklama
  isFirstFreeView?: boolean; // İlk ücretsiz hak var mı
  photoIndex?: number; // Fotoğraf sıra numarası (ilk fotoğraf 0)
  isUnlocked?: boolean; // Medya açık mı (token harcandı veya ilk ücretsiz)
  onAudioListened?: (messageId: string) => void; // Ses dinlendiğinde (ephemeral)
  isAudioListened?: boolean; // Ses zaten dinlendi mi
}

const MessageBubble: React.FC<Props> = ({ 
  message, 
  isMine, 
  onMediaPress,
  isFirstFreeView = false,
  photoIndex = 0,
  isUnlocked = false,
  onAudioListened,
  isAudioListened = false,
}) => {
  const bubbleStyle = isMine ? styles.bubbleMine : styles.bubbleOther;

  // Sistem mesajı render
  const renderSystemMessage = () => {
    return (
      <View style={styles.systemContainer}>
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  };

  // TOKEN_GIFT mesajı render - YENİ
  const renderTokenGiftMessage = () => {
    const amount = message.tokenAmount || 0;
    
    return (
      <View style={styles.giftContainer}>
        <View style={[styles.giftBubble, isMine ? styles.giftBubbleMine : styles.giftBubbleOther]}>
          <Text style={styles.giftIcon}>💎</Text>
          <View style={styles.giftContent}>
            <Text style={styles.giftAmount}>{amount} Jeton</Text>
            <Text style={styles.giftLabel}>
              {isMine ? 'Gönderdin' : `${message.senderNickname || 'Birisi'} gönderdi`}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // İlk fotoğraf mı kontrolü (index 0 = ücretsiz)
  const isFirstPhoto = photoIndex === 0;

  const renderContent = () => {
    // VIDEO
    if (message.mediaUrl && message.mediaType === 'video') {
      // Durumlar: isMine, isFirstFreeView, isUnlocked (görüntülenmiş)
      const showFree = !isMine && isFirstFreeView && !isUnlocked;
      const showViewed = !isMine && isUnlocked;
      const showLock = !isMine && !isFirstFreeView && !isUnlocked;
      
      return (
        <TouchableOpacity 
          style={styles.mediaContainer}
          onPress={() => onMediaPress?.(message)}
          activeOpacity={showViewed ? 1 : 0.8}
          disabled={showViewed}
        >
          <Image
            source={{ uri: message.mediaUrl }}
            style={[
              styles.blurMedia,
              showViewed && styles.viewedMedia
            ]}
            blurRadius={showLock ? 20 : 0}
          />
          {showLock && (
            <View style={styles.mediaOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.tokenCost}>50 jeton</Text>
            </View>
          )}
          {showFree && (
            <View style={styles.freeOverlay}>
              <Text style={styles.freeBadge}>✨ Ücretsiz</Text>
            </View>
          )}
          {showViewed && (
            <View style={styles.viewedOverlay}>
              <Text style={styles.viewedBadge}>👁️ Görüntülendi</Text>
            </View>
          )}
          <View style={styles.videoIndicator}>
            <Text style={styles.videoIcon}>▶️</Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    // PHOTO
    if (message.mediaUrl && (message.mediaType === 'photo' || !message.mediaType)) {
      // Durumlar:
      // 1. isMine = kendi fotoğrafım (sınırsız görüntüleme)
      // 2. isFirstFreeView = ilk ücretsiz fotoğraf (henüz açılmamış)
      // 3. isUnlocked = zaten görüntülenmiş (ephemeral - tekrar açılamaz)
      // 4. Kilitli = token gerekli
      
      const showFree = !isMine && isFirstFreeView && !isUnlocked;
      const showViewed = !isMine && isUnlocked; // Zaten görüntülenmiş
      const showLock = !isMine && !isFirstFreeView && !isUnlocked;
      
      return (
        <TouchableOpacity 
          style={styles.mediaContainer}
          onPress={() => onMediaPress?.(message)}
          activeOpacity={showViewed ? 1 : 0.8} // Görüntülenmişse tıklama efekti yok
          disabled={showViewed} // Görüntülenmişse tıklanamaz
        >
          {/* Görüntülenmiş fotoğraf gri/soluk, diğerleri normal veya blur */}
          <Image
            source={{ uri: message.mediaUrl }}
            style={[
              styles.blurMedia,
              showViewed && styles.viewedMedia // Görüntülenmişse soluk
            ]}
            blurRadius={showLock ? 20 : 0}
          />
          {/* Kilitli */}
          {showLock && (
            <View style={styles.mediaOverlay}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.tokenCost}>20 jeton</Text>
            </View>
          )}
          {/* İlk ücretsiz */}
          {showFree && (
            <View style={styles.freeOverlay}>
              <Text style={styles.freeBadge}>✨ Ücretsiz</Text>
            </View>
          )}
          {/* GÖRÜNTÜLENDI - Ephemeral badge */}
          {showViewed && (
            <View style={styles.viewedOverlay}>
              <Text style={styles.viewedBadge}>👁️ Görüntülendi</Text>
            </View>
          )}
          {/* Tip göstergesi */}
          <View style={styles.typeIndicator}>
            <Text style={styles.typeText}>
              {message.isInstant ? '📷' : '🖼️'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    
    // AUDIO - AudioMessage componentini kullan
    if (message.mediaType === 'audio' && message.mediaUrl) {
      // İlk ses ücretsiz, sonrakiler 5 token
      const isFirstAudio = photoIndex === 0;
      // Kilitli mi? Kendi mesajım değil + ilk değil + unlock olmamış
      const audioLocked = !isMine && !isFirstAudio && !isUnlocked;
      // isUnlocked=true ise (arkadaş sohbeti) birden fazla dinlemeye izin ver
      const allowMultiple = isUnlocked;
      
      return (
        <AudioMessage
          audioUrl={message.mediaUrl}
          duration={message.duration || 0}
          isMine={isMine}
          isLocked={audioLocked}
          isFirstFree={isFirstAudio && !isMine}
          tokenCost={5}
          onUnlockPress={() => onMediaPress?.(message)}
          onListened={() => onAudioListened?.(message.id)}
          isListened={isAudioListened}
          allowMultipleListens={allowMultiple}
        />
      );
    }
    
    // TEXT
    return (
      <Text style={[FONTS.body, { color: COLORS.text }]}>
        {message.content}
      </Text>
    );
  };

  // Sistem mesajı ise özel render
  if (message.isSystem) {
    return renderSystemMessage();
  }

  // TOKEN_GIFT mesajı ise özel render - YENİ
  if (message.messageType === 'TOKEN_GIFT') {
    return renderTokenGiftMessage();
  }

  return (
    <View
      style={[
        styles.container,
        { justifyContent: isMine ? 'flex-end' : 'flex-start' },
      ]}
    >
      <View style={[styles.bubble, bubbleStyle]}>
        {renderContent()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: SPACING.md,
  },
  bubbleMine: {
    backgroundColor: COLORS.primary,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
  },
  // Sistem mesajı
  systemContainer: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  systemBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: '80%',
  },
  systemText: {
    ...FONTS.caption,
    color: COLORS.accent,
  },
  // TOKEN_GIFT mesajı - YENİ
  giftContainer: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  giftBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  giftBubbleMine: {
    backgroundColor: '#FFD700',
  },
  giftBubbleOther: {
    backgroundColor: '#FFD700',
  },
  giftIcon: {
    fontSize: 32,
    marginRight: SPACING.sm,
  },
  giftContent: {
    alignItems: 'center',
  },
  giftAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  giftLabel: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  // Media container
  mediaContainer: {
    width: 160,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  blurMedia: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  tokenCost: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 12,
  },
  freeBadge: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  freeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  typeIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    fontSize: 12,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 14,
  },
  // Audio
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
    paddingVertical: SPACING.xs,
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioIcon: {
    fontSize: 16,
  },
  audioWave: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  audioWaveBars: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    gap: 2,
  },
  audioWaveBar: {
    width: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  audioText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  audioFreeBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  audioFreeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  audioPlayButtonUnlocked: {
    backgroundColor: COLORS.primary,
  },
  audioWaveBarUnlocked: {
    backgroundColor: COLORS.primary,
  },
  // Video player
  videoContainer: {
    width: 200,
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  // GÖRÜNTÜLENDI durumu (ephemeral)
  viewedMedia: {
    opacity: 0.5,
  },
  viewedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewedBadge: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    overflow: 'hidden',
  },
});

export default MessageBubble;

