import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

interface Props {
  audioUrl: string;
  duration?: number;
  isMine: boolean;
  isLocked: boolean;
  isFirstFree: boolean;
  tokenCost: number;
  onUnlockPress?: () => void;
  onListened?: () => void;
  isListened?: boolean;
  allowMultipleListens?: boolean;
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
  allowMultipleListens = false,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration * 1000);
  const [hasBeenListened, setHasBeenListened] = useState(isListened);
  
  const waveAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  useEffect(() => {
    if (isPlaying) {
      // Wave animasyonu
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(waveAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      waveAnimation.setValue(0);
    }
  }, [isPlaying]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const loadAndPlay = async () => {
    try {
      setIsLoading(true);
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

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
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        
        if (!isMine && !hasBeenListened && !allowMultipleListens) {
          setHasBeenListened(true);
          onListened?.();
        }
      }
    }
  };

  const togglePlayPause = async () => {
    if (isLocked && !isMine) {
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
        style={styles.container} 
        onPress={onUnlockPress}
        activeOpacity={0.8}
      >
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconContainer}>
            <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} />
          </View>
          <View style={styles.lockedInfo}>
            <Text style={styles.lockedText}>Ses Mesajı</Text>
            <View style={styles.lockedCostRow}>
              <Ionicons name="diamond" size={12} color={COLORS.accent} />
              <Text style={styles.lockedCostText}>{tokenCost} elmas</Text>
            </View>
          </View>
          {isFirstFree && (
            <View style={styles.freeAbsoluteBadge}>
              <Ionicons name="sparkles" size={10} color={COLORS.text} />
              <Text style={styles.freeBadgeText}>Ücretsiz</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // Dinlenmiş ses görünümü (ephemeral)
  if (hasBeenListened && !isMine && !allowMultipleListens) {
    return (
      <View style={styles.container}>
        <View style={styles.listenedContainer}>
          <View style={styles.listenedIconContainer}>
            <Ionicons name="ear" size={18} color={COLORS.textMuted} />
          </View>
          <View style={styles.listenedInfo}>
            <Text style={styles.listenedText}>Dinlendi</Text>
            <Text style={styles.listenedSubtext}>Tek seferlik dinleme hakkı kullanıldı</Text>
          </View>
        </View>
      </View>
    );
  }

  // Normal görünüm
  const Container = isMine ? LinearGradient : View;
  const containerProps = isMine ? {
    colors: [COLORS.primary, COLORS.primaryDark] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    style: styles.audioContainer,
  } : {
    style: [styles.audioContainer, styles.audioContainerOther],
  };

  return (
    <View style={styles.container}>
      <Container {...containerProps as any}>
        {/* Play/Pause Button */}
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.text} />
          ) : (
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={20} 
              color={COLORS.text} 
            />
          )}
        </TouchableOpacity>

        {/* Waveform / Progress */}
        <View style={styles.waveContainer}>
          <View style={styles.waveformContainer}>
            {[...Array(20)].map((_, i) => (
              <Animated.View 
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: 4 + Math.random() * 12,
                    backgroundColor: i / 20 * 100 <= progress ? COLORS.accent : 'rgba(255, 255, 255, 0.3)',
                    transform: [{
                      scaleY: isPlaying ? waveAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.6 + Math.random() * 0.4],
                      }) : 1,
                    }],
                  }
                ]} 
              />
            ))}
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(totalDuration)}</Text>
          </View>
        </View>

        {/* İlk ücretsiz badge */}
        {isFirstFree && !isMine && (
          <View style={styles.freeIndicator}>
            <Ionicons name="sparkles" size={14} color={COLORS.success} />
          </View>
        )}
      </Container>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 20,
    minWidth: 220,
    maxWidth: 280,
  },
  audioContainerOther: {
    backgroundColor: COLORS.surface,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveContainer: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  freeIndicator: {
    marginLeft: SPACING.xs,
  },
  // Kilitli görünüm
  lockedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    minWidth: 200,
    maxWidth: 280,
    position: 'relative',
  },
  lockedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  lockedText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  lockedCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lockedCostText: {
    fontSize: 12,
    color: COLORS.accent,
  },
  freeAbsoluteBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  freeBadgeText: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '600',
  },
  // Dinlenmiş ses görünümü
  listenedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 20,
    backgroundColor: 'rgba(100, 100, 100, 0.3)',
    minWidth: 200,
    maxWidth: 280,
    opacity: 0.7,
  },
  listenedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listenedInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  listenedText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  listenedSubtext: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});

export default AudioMessage;
