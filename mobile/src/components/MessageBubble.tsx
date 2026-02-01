import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    messageType?: 'TEXT' | 'MEDIA' | 'TOKEN_GIFT' | 'SYSTEM';
    tokenAmount?: number;
    senderNickname?: string;
    receiverNickname?: string;
    isInstant?: boolean;
    isViewed?: boolean;
    duration?: number;
    createdAt?: string;
    isSystem?: boolean;
    systemType?: 'gift' | 'stage' | 'info' | 'friend';
    systemData?: {
      fromNickname?: string;
      amount?: number;
      newStage?: number;
    };
  };
  isMine: boolean;
  onMediaPress?: (message: any) => void;
  isFirstFreeView?: boolean;
  photoIndex?: number;
  isUnlocked?: boolean;
  onAudioListened?: (messageId: string) => void;
  isAudioListened?: boolean;
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
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Timestamp formatı
  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Dün ${timeStr}`;
    } else {
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) + ' ' + timeStr;
    }
  };

  // Sistem mesajı render
  const renderSystemMessage = () => {
    return (
      <View style={styles.systemContainer}>
        <View style={styles.systemBubble}>
          <Ionicons 
            name={
              message.systemType === 'friend' ? 'heart' :
              message.systemType === 'stage' ? 'arrow-up-circle' :
              message.systemType === 'gift' ? 'gift' : 'information-circle'
            } 
            size={14} 
            color={COLORS.accent} 
            style={{ marginRight: 4 }}
          />
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  };

  // TOKEN_GIFT mesajı render
  const renderTokenGiftMessage = () => {
    const amount = message.tokenAmount || 0;
    
    return (
      <Animated.View 
        style={[
          styles.giftContainer,
          { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.giftBubble}
        >
          <View style={styles.giftIconContainer}>
            <Ionicons name="diamond" size={28} color="#1a1a1a" />
          </View>
          <View style={styles.giftContent}>
            <Text style={styles.giftAmount}>{amount}</Text>
            <Text style={styles.giftLabel}>
              {isMine ? 'Elmas Gönderildi' : 'Elmas Alındı'}
            </Text>
          </View>
          {!isMine && (
            <View style={styles.giftSenderBadge}>
              <Text style={styles.giftSenderText}>
                {message.senderNickname || 'Birisi'}
              </Text>
            </View>
          )}
        </LinearGradient>
        {message.createdAt && (
          <Text style={styles.giftTimestamp}>{formatTimestamp(message.createdAt)}</Text>
        )}
      </Animated.View>
    );
  };

  // İlk fotoğraf mı kontrolü
  const isFirstPhoto = photoIndex === 0;

  const renderContent = () => {
    // VIDEO
    if (message.mediaUrl && message.mediaType === 'video') {
      // showViewed = zaten görüntülendi (ephemeral - tekrar izlenemez)
      const showViewed = !isMine && message.isViewed;
      // showLock = kilitli (ödeme gerekli)
      const showLock = !isMine && !isFirstFreeView && !isUnlocked && !showViewed;
      // isViewable = izlenebilir (ilk ücretsiz veya açılmış)
      const isViewable = isMine || isFirstFreeView || isUnlocked;
      // disabled = görüntülendi ise tıklanamaz
      const isDisabled = showViewed;
      
      return (
        <TouchableOpacity 
          style={styles.mediaContainer}
          onPress={() => onMediaPress?.(message)}
          activeOpacity={isDisabled ? 1 : 0.8}
          disabled={isDisabled}
        >
          {message.mediaUrl ? (
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.blurMedia}
              blurRadius={showLock ? 50 : 0}
            />
          ) : (
            <View style={[styles.blurMedia, { backgroundColor: '#333' }]} />
          )}
          
          {/* Kilitli durumu - koyu overlay */}
          {showLock && (
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
              style={styles.mediaOverlay}
            >
              <View style={styles.lockContainer}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.text} />
                </View>
                <Text style={styles.tokenCost}>50 elmas</Text>
                <Text style={styles.tapToUnlock}>Açmak için dokun</Text>
              </View>
            </LinearGradient>
          )}
          
          {/* Görüntülendi durumu */}
          {showViewed && (
            <View style={styles.viewedOverlay}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.textMuted} />
              <Text style={styles.viewedBadge}>Görüntülendi</Text>
            </View>
          )}
          
          {/* İzlenebilir video - play butonu */}
          {isViewable && !showViewed && (
            <View style={styles.playOverlay}>
              <View style={styles.playButtonLarge}>
                <Ionicons name="play" size={32} color="#fff" />
              </View>
            </View>
          )}
          
          {/* Video ikonu */}
          <View style={styles.mediaTypeLabel}>
            <Ionicons name="videocam" size={12} color={COLORS.text} />
          </View>
        </TouchableOpacity>
      );
    }
    
    // PHOTO
    if (message.mediaUrl && (message.mediaType === 'photo' || !message.mediaType)) {
      // showViewed = zaten görüntülendi (ephemeral - tekrar izlenemez)
      const showViewed = !isMine && message.isViewed;
      // showLock = kilitli (ödeme gerekli)
      const showLock = !isMine && !isFirstFreeView && !isUnlocked && !showViewed;
      // isViewable = izlenebilir (ilk ücretsiz veya açılmış)
      const isViewable = isMine || isFirstFreeView || isUnlocked;
      // disabled = görüntülendi ise tıklanamaz
      const isDisabled = showViewed;
      
      return (
        <TouchableOpacity 
          style={styles.mediaContainer}
          onPress={() => onMediaPress?.(message)}
          activeOpacity={isDisabled ? 1 : 0.8}
          disabled={isDisabled}
        >
          {message.mediaUrl ? (
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.blurMedia}
              blurRadius={showLock ? 50 : 0}
            />
          ) : (
            <View style={[styles.blurMedia, { backgroundColor: '#333' }]} />
          )}
          
          {/* Kilitli durumu - koyu overlay */}
          {showLock && (
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
              style={styles.mediaOverlay}
            >
              <View style={styles.lockContainer}>
                <View style={styles.lockIconCircle}>
                  <Ionicons name="lock-closed" size={20} color={COLORS.text} />
                </View>
                <Text style={styles.tokenCost}>20 elmas</Text>
                <Text style={styles.tapToUnlock}>Açmak için dokun</Text>
              </View>
            </LinearGradient>
          )}
          
          {/* Görüntülendi durumu */}
          {showViewed && (
            <View style={styles.viewedOverlay}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.textMuted} />
              <Text style={styles.viewedBadge}>Görüntülendi</Text>
            </View>
          )}
          
          {/* İzlenebilir fotoğraf - tap to view */}
          {isViewable && !showViewed && !isMine && (
            <View style={styles.viewableOverlay}>
              <View style={styles.viewHint}>
                <Ionicons name="expand" size={16} color="#fff" />
                <Text style={styles.viewHintText}>Görmek için dokun</Text>
              </View>
            </View>
          )}
          
          {/* Medya tipi ikonu */}
          <View style={styles.mediaTypeLabel}>
            <Ionicons 
              name={message.isInstant ? 'camera' : 'image'} 
              size={12} 
              color={COLORS.text} 
            />
          </View>
        </TouchableOpacity>
      );
    }
    
    // AUDIO
    if (message.mediaType === 'audio' && message.mediaUrl) {
      const isFirstAudio = photoIndex === 0;
      const audioLocked = !isMine && !isFirstAudio && !isUnlocked;
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
      <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
        {message.content}
      </Text>
    );
  };

  // Sistem mesajı ise özel render
  if (message.isSystem) {
    return renderSystemMessage();
  }

  // TOKEN_GIFT mesajı ise özel render
  if (message.messageType === 'TOKEN_GIFT') {
    return renderTokenGiftMessage();
  }

  const hasMedia = message.mediaUrl || message.mediaType === 'audio';

  return (
    <Animated.View 
      style={[
        styles.container,
        { justifyContent: isMine ? 'flex-end' : 'flex-start' },
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={[styles.bubbleWrapper, isMine && styles.bubbleWrapperMine]}>
        {isMine ? (
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.bubble, 
              styles.bubbleMine,
              hasMedia && styles.bubbleMedia,
            ]}
          >
            {renderContent()}
          </LinearGradient>
        ) : (
          <View style={[
            styles.bubble, 
            styles.bubbleOther,
            hasMedia && styles.bubbleMedia,
          ]}>
            {renderContent()}
          </View>
        )}
        
        {/* Timestamp ve Read Receipt */}
        <View style={[styles.metaRow, isMine && styles.metaRowMine]}>
          {message.createdAt && (
            <Text style={styles.timestamp}>{formatTimestamp(message.createdAt)}</Text>
          )}
          {isMine && (
            <View style={styles.readReceipt}>
              <Ionicons 
                name={message.isViewed ? 'checkmark-done' : 'checkmark'} 
                size={14} 
                color={message.isViewed ? COLORS.accent : COLORS.textMuted} 
              />
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  bubbleWrapper: {
    maxWidth: '78%',
  },
  bubbleWrapperMine: {
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 20,
    padding: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  bubbleMine: {
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 6,
  },
  bubbleMedia: {
    padding: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.text,
  },
  messageTextMine: {
    color: COLORS.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metaRowMine: {
    justifyContent: 'flex-end',
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  readReceipt: {
    marginLeft: 2,
  },
  // Sistem mesajı
  systemContainer: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  systemBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 212, 212, 0.15)',
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: '85%',
  },
  systemText: {
    fontSize: 13,
    color: COLORS.accent,
  },
  // TOKEN_GIFT mesajı
  giftContainer: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  giftBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minWidth: 180,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  giftIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  giftContent: {
    flex: 1,
  },
  giftAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  giftLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  giftSenderBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  giftSenderText: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '500',
  },
  giftTimestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  // Media container
  mediaContainer: {
    width: 180,
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.surface,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContainer: {
    alignItems: 'center',
    gap: 8,
  },
  lockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tokenCost: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  tapToUnlock: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  mediaTypeLabel: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    padding: 6,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Play overlay for viewable videos
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  playButtonLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  // Viewable photo overlay
  viewableOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 12,
  },
  viewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  viewHintText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  // GÖRÜNTÜLENDI durumu
  viewedMedia: {
    opacity: 0.5,
  },
  viewedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  viewedBadge: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default MessageBubble;
