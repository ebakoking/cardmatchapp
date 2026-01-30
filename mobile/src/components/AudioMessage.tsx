import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

interface Props {
  audioUrl: string;
  duration?: number; // saniye
  isMine: boolean;
  isLocked: boolean; // Kilitli mi (token gerekiyor)
  isFirstFree: boolean; // İlk ücretsiz hak
  tokenCost: number;
  onUnlockPress?: () => void; // Kilit açma modal'ı aç
  onListened?: () => void; // Ses dinlendikten sonra çağrılır (ephemeral için)
  isListened?: boolean; // Ses zaten dinlendi mi (bir kez dinleme hakkı)
  allowMultipleListens?: boolean; // Birden fazla dinlemeye izin ver (arkadaş sohbeti için)
}

const AudioMessage: React.FC<Props> = ({
  audioUrl,
  duration = 0,
  isMine,
  isLocked,
  isFirstFree,
  tokenCost,
  onUnlockPress,
  onListened,
  isListened = false,
  allowMultipleListens = false, // Varsayılan: tek seferlik dinleme (match için)
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration * 1000);
  const [hasBeenListened, setHasBeenListened] = useState(isListened); // Lokal dinleme durumu

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const loadAndPlay = async () => {
    try {
      setIsLoading(true);
      
      // Audio mode ayarla
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Ses yükle
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (error) {
      console.error('[AudioMessage] Failed to load audio:', error);
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setTotalDuration(status.durationMillis || duration * 1000);
      setIsPlaying(status.isPlaying);
      
      // Ses bittiğinde - EPHEMERAL: Dinlendi olarak işaretle
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        
        // Kendi sesimiz değilse ve daha önce dinlenmediyse -> dinlendi olarak işaretle
        // allowMultipleListens=true ise bu özellik devre dışı (arkadaş sohbeti için)
        if (!isMine && !hasBeenListened && !allowMultipleListens) {
          setHasBeenListened(true);
          onListened?.();
        }
      }
    }
  };

  const togglePlayPause = async () => {
    if (isLocked && !isMine) {
      // Kilitli - modal aç
      onUnlockPress?.();
      return;
    }

    if (!sound) {
      await loadAndPlay();
    } else {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    }
  };

  const progress = totalDuration > 0 ? (position / totalDuration) * 100 : 0;

  // Kilitli görünüm
  if (isLocked && !isMine) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.lockedContainer]} 
        onPress={onUnlockPress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.lockedText}>Ses Mesajı</Text>
          <Text style={styles.tokenText}>{tokenCost} jeton</Text>
        </View>
        {isFirstFree && (
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>✨ Ücretsiz</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // EPHEMERAL: Zaten dinlenmiş ses - karşı tarafın sesi için
  // Sadece allowMultipleListens=false ise göster (match chat için)
  if (hasBeenListened && !isMine && !allowMultipleListens) {
    return (
      <View style={[styles.container, styles.listenedContainer]}>
        <View style={styles.listenedIconContainer}>
          <Text style={styles.listenedIcon}>👂</Text>
        </View>
        <View style={styles.infoContainer}>
          <Text style={styles.listenedText}>Ses Dinlendi</Text>
          <Text style={styles.listenedSubtext}>Bir kez dinleme hakkı kullanıldı</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isMine ? styles.mineContainer : styles.otherContainer]}>
      {/* Play/Pause Button */}
      <TouchableOpacity 
        style={styles.playButton} 
        onPress={togglePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Text style={styles.playIcon}>{isPlaying ? '⏸️' : '▶️'}</Text>
        )}
      </TouchableOpacity>

      {/* Waveform / Progress */}
      <View style={styles.waveContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.durationText}>
          {formatTime(position)} / {formatTime(totalDuration)}
        </Text>
      </View>

      {/* İlk ücretsiz badge */}
      {isFirstFree && !isMine && (
        <View style={styles.freeIndicator}>
          <Text style={styles.freeIndicatorText}>✨</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 16,
    minWidth: 200,
    maxWidth: 280,
  },
  mineContainer: {
    backgroundColor: COLORS.primary,
  },
  otherContainer: {
    backgroundColor: COLORS.surface,
  },
  lockedContainer: {
    backgroundColor: COLORS.surface,
    opacity: 0.9,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 18,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 18,
  },
  infoContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  lockedText: {
    ...FONTS.body,
    color: COLORS.text,
  },
  tokenText: {
    ...FONTS.caption,
    color: COLORS.accent,
  },
  waveContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  durationText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  freeBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  freeBadgeText: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  freeIndicator: {
    marginLeft: SPACING.xs,
  },
  freeIndicatorText: {
    fontSize: 14,
  },
  // Dinlenmiş ses görünümü
  listenedContainer: {
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
    opacity: 0.7,
  },
  listenedIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listenedIcon: {
    fontSize: 18,
  },
  listenedText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  listenedSubtext: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    fontSize: 10,
  },
});

export default AudioMessage;
