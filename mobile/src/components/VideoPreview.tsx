import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Maksimum video süresi (saniye)
const MAX_VIDEO_DURATION = 60; // 60 saniyeye çıkardık, daha esnek

interface Props {
  visible: boolean;
  videoUri: string;
  onClose: () => void;
  onSend: () => void;
}

const VideoPreview: React.FC<Props> = ({ visible, videoUri, onClose, onSend }) => {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Safe area hesaplama
  const topInset = insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44);
  const bottomInset = insets.bottom || (Platform.OS === 'android' ? 24 : 34);

  // Video için kullanılabilir alan
  const headerHeight = 56;
  const controlsHeight = 200;
  const availableHeight = SCREEN_HEIGHT - topInset - bottomInset - headerHeight - controlsHeight;
  const videoHeight = Math.min(availableHeight, SCREEN_WIDTH * 1.2);
  const videoWidth = SCREEN_WIDTH - 24;

  // Derived states
  const durationSeconds = Math.floor(duration / 1000);
  const isTooLong = durationSeconds > MAX_VIDEO_DURATION;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(false);
      setPosition(0);
      setIsLoading(true);
      setIsSending(false);
      setDuration(0);
    }
  }, [visible]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);

      if (status.didJustFinish) {
        videoRef.current?.setPositionAsync(0);
        setIsPlaying(false);
      }
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current || isLoading) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const handleSend = async () => {
    // Video çok uzunsa uyarı göster
    if (isTooLong) {
      Alert.alert(
        'Video Çok Uzun',
        `Bu video ${durationSeconds} saniye. Maksimum ${MAX_VIDEO_DURATION} saniye olmalı.\n\nLütfen daha kısa bir video seçin veya telefonunuzun galeri uygulamasından videoyu kırpın.`,
        [{ text: 'Tamam' }]
      );
      return;
    }

    setIsSending(true);
    if (videoRef.current) {
      await videoRef.current.pauseAsync();
    }
    onSend();
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Video</Text>

          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButton, isTooLong && styles.sendButtonDisabled]}
            disabled={isSending || isLoading}
          >
            {isSending ? (
              <View style={styles.sendButtonLoading}>
                <ActivityIndicator size="small" color={COLORS.text} />
              </View>
            ) : (
              <LinearGradient
                colors={isTooLong ? ['#666', '#444'] : [COLORS.primary, COLORS.primaryDark]}
                style={styles.sendButtonGradient}
              >
                <Ionicons name="send" size={16} color={COLORS.text} />
                <Text style={styles.sendButtonText}>Gönder</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {/* Video Player */}
        <View style={styles.videoContainer}>
          <TouchableOpacity
            style={[styles.videoWrapper, { width: videoWidth, height: videoHeight }]}
            onPress={togglePlayPause}
            activeOpacity={0.95}
          >
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {/* Loading */}
            {isLoading && (
              <View style={styles.overlay}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Yükleniyor...</Text>
              </View>
            )}

            {/* Play button */}
            {!isLoading && !isPlaying && (
              <View style={styles.overlay}>
                <View style={styles.playButton}>
                  <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 4 }} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Progress */}
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          {/* Play/Pause */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={togglePlayPause}
            disabled={isLoading}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color={COLORS.text}
              style={!isPlaying ? { marginLeft: 3 } : undefined}
            />
          </TouchableOpacity>

          {/* Duration Badge */}
          <View style={styles.infoSection}>
            <View style={[styles.durationBadge, isTooLong && styles.durationBadgeError]}>
              <Ionicons 
                name={isTooLong ? 'warning' : 'videocam'} 
                size={16} 
                color={isTooLong ? '#ff4444' : COLORS.accent} 
              />
              <Text style={[styles.durationText, isTooLong && styles.durationTextError]}>
                {duration > 0 ? `${durationSeconds} saniye` : 'Yükleniyor...'}
              </Text>
            </View>
            
            {isTooLong ? (
              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={16} color="#ff4444" />
                <Text style={styles.warningText}>
                  Video çok uzun! Maks. {MAX_VIDEO_DURATION} saniye olmalı.
                </Text>
              </View>
            ) : (
              <Text style={styles.infoSubtext}>
                Video önizlemesi • Göndermek için butona bas
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonLoading: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 6,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controls: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  progressSection: {
    marginBottom: SPACING.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontVariant: ['tabular-nums'],
  },
  controlButton: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  infoSection: {
    alignItems: 'center',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(125, 212, 212, 0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
  },
  durationBadgeError: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
  },
  durationText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
  durationTextError: {
    color: '#ff4444',
  },
  infoSubtext: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,68,68,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#ff4444',
  },
});

export default VideoPreview;
