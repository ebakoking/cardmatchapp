import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import ProfilePhoto from '../../components/ProfilePhoto';

// Avatar listesi
// Avatar listesi - merkezi dosyadan import
import { AVATARS, getAvatar } from '../../constants/avatars';

type Props = NativeStackScreenProps<any, 'FriendCall'>;

type CallStatus = 'calling' | 'ringing' | 'connected' | 'ended';

const FriendCallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { friendshipId, friendNickname, friendPhoto, friendAvatarId, friendId, callType, isIncoming } = route.params || {};
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<CallStatus>(isIncoming ? 'ringing' : 'calling');
  
  // Alert modal state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // Avatar helper - merkezi dosyadan import ediliyor
  const avatar = getAvatar(friendAvatarId);
  
  // Themed alert helper
  const showThemedAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };
  
  const handleAlertClose = () => {
    setAlertVisible(false);
    navigation.goBack();
  };
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const callStartTime = useRef<number | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation for calling state
  useEffect(() => {
    if (callStatus === 'calling' || callStatus === 'ringing') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [callStatus, pulseAnim]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    // Arama kabul edildi
    socket.on('friend:call:accepted', (payload: { friendshipId: string }) => {
      if (payload.friendshipId === friendshipId) {
        setCallStatus('connected');
        callStartTime.current = Date.now();
        startDurationTimer();
      }
    });

    // Arama reddedildi
    socket.on('friend:call:rejected', (payload: { friendshipId: string }) => {
      if (payload.friendshipId === friendshipId) {
        setCallStatus('ended');
        showThemedAlert('Arama Reddedildi', 'Karşı taraf aramayı reddetti.');
      }
    });

    // Arama sonlandırıldı
    socket.on('friend:call:ended', (payload: { endedBy: string }) => {
      setCallStatus('ended');
      stopDurationTimer();
      if (payload.endedBy !== user?.id) {
        showThemedAlert('Arama Sona Erdi', 'Karşı taraf aramayı sonlandırdı.');
      }
    });

    return () => {
      socket.off('friend:call:accepted');
      socket.off('friend:call:rejected');
      socket.off('friend:call:ended');
      stopDurationTimer();
    };
  }, [friendshipId, user?.id]);

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      if (callStartTime.current) {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
  };

  // Aramayı kabul et (gelen arama için)
  const acceptCall = () => {
    const socket = getSocket();
    socket.emit('friend:call:accept', {
      friendshipId,
      callType,
      callerId: friendId, // Arayanın ID'si
    });
    setCallStatus('connected');
    callStartTime.current = Date.now();
    startDurationTimer();
  };

  // Aramayı reddet (gelen arama için)
  const rejectCall = () => {
    const socket = getSocket();
    socket.emit('friend:call:reject', {
      friendshipId,
      callerId: friendId, // Arayanın ID'si
    });
    navigation.goBack();
  };

  // Aramayı sonlandır
  const endCall = () => {
    const socket = getSocket();
    socket.emit('friend:call:end', {
      friendshipId,
    });
    stopDurationTimer();
    navigation.goBack();
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Aranıyor...';
      case 'ringing':
        return 'Gelen Arama';
      case 'connected':
        return formatDuration(callDuration);
      case 'ended':
        return 'Arama Sona Erdi';
    }
  };

  return (
    <LinearGradient
      colors={[COLORS.background, '#1a1a2e', COLORS.background]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Call Type Badge */}
          <View style={styles.callTypeBadge}>
            <Ionicons 
              name={callType === 'video' ? 'videocam' : 'call'} 
              size={16} 
              color={COLORS.text} 
            />
            <Text style={styles.callTypeText}>
              {callType === 'video' ? 'Görüntülü Arama' : 'Sesli Arama'}
            </Text>
          </View>

          {/* Profile Photo / Avatar */}
          <View style={styles.profileSection}>
            <Animated.View style={[
              styles.profileContainer,
              (callStatus === 'calling' || callStatus === 'ringing') && {
                transform: [{ scale: pulseAnim }]
              }
            ]}>
              {friendPhoto ? (
                <ProfilePhoto uri={friendPhoto} size={150} />
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: avatar.color }]}>
                  <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                </View>
              )}
            </Animated.View>
            <Text style={styles.nickname}>{friendNickname}</Text>
            <Text style={styles.status}>{getStatusText()}</Text>
          </View>

          {/* Video placeholder (for video calls) */}
          {callType === 'video' && callStatus === 'connected' && (
            <View style={styles.videoPlaceholder}>
              <Ionicons name="videocam-off" size={48} color={COLORS.textMuted} />
              <Text style={styles.videoPlaceholderText}>
                Video arama entegrasyonu için{'\n'}Agora SDK gerekli
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            {callStatus === 'ringing' ? (
              // Gelen arama kontrolleri - YEŞİL (Kabul) / KIRMIZI (Reddet)
              <View style={styles.incomingControls}>
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.rejectButton]}
                    onPress={rejectCall}
                  >
                    <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Reddet</Text>
                </View>
                
                <View style={styles.buttonWrapper}>
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.acceptButton]}
                    onPress={acceptCall}
                  >
                    <Ionicons name="call" size={32} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.buttonLabel}>Kabul Et</Text>
                </View>
              </View>
            ) : callStatus === 'connected' ? (
              // Bağlı arama kontrolleri
              <>
                <View style={styles.midControls}>
                  <TouchableOpacity 
                    style={[styles.controlButton, styles.smallButton, isMuted && styles.activeControl]}
                    onPress={() => setIsMuted(!isMuted)}
                  >
                    <Ionicons 
                      name={isMuted ? 'mic-off' : 'mic'} 
                      size={24} 
                      color={COLORS.text} 
                    />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.controlButton, styles.smallButton, isSpeakerOn && styles.activeControl]}
                    onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                  >
                    <Ionicons 
                      name={isSpeakerOn ? 'volume-high' : 'volume-medium'} 
                      size={24} 
                      color={COLORS.text} 
                    />
                  </TouchableOpacity>

                  {callType === 'video' && (
                    <TouchableOpacity 
                      style={[styles.controlButton, styles.smallButton, !isVideoEnabled && styles.activeControl]}
                      onPress={() => setIsVideoEnabled(!isVideoEnabled)}
                    >
                      <Ionicons 
                        name={isVideoEnabled ? 'videocam' : 'videocam-off'} 
                        size={24} 
                        color={COLORS.text} 
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity 
                  style={[styles.controlButton, styles.endButton]}
                  onPress={endCall}
                >
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
              </>
            ) : callStatus === 'calling' ? (
              // Arıyor kontrolleri
              <View style={styles.callingControls}>
                <Text style={styles.callingHint}>Bağlanmayı bekliyor...</Text>
                <TouchableOpacity 
                  style={[styles.controlButton, styles.endButton]}
                  onPress={endCall}
                >
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
        
        {/* Themed Alert Modal */}
        <Modal visible={alertVisible} transparent animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={styles.alertContent}>
              <Ionicons 
                name={alertTitle.includes('Reddedildi') ? 'close-circle' : 'call'} 
                size={48} 
                color={alertTitle.includes('Reddedildi') ? '#E74C3C' : COLORS.primary} 
              />
              <Text style={styles.alertTitle}>{alertTitle}</Text>
              <Text style={styles.alertMessage}>{alertMessage}</Text>
              <TouchableOpacity style={styles.alertButton} onPress={handleAlertClose}>
                <Text style={styles.alertButtonText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xxl,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.primary + '50',
  },
  callTypeText: {
    ...FONTS.caption,
    color: COLORS.text,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
  },
  profileContainer: {
    borderRadius: 100,
    borderWidth: 4,
    borderColor: COLORS.primary,
    padding: 4,
  },
  avatarCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 72,
  },
  nickname: {
    ...FONTS.h1,
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  status: {
    ...FONTS.body,
    color: COLORS.accent,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },
  videoPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: SPACING.xl,
    borderRadius: 16,
    alignItems: 'center',
  },
  videoPlaceholderText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  controls: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: SPACING.xl,
  },
  incomingControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  buttonWrapper: {
    alignItems: 'center',
  },
  buttonLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  callingControls: {
    alignItems: 'center',
  },
  callingHint: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  midControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surface,
  },
  activeControl: {
    backgroundColor: COLORS.primary,
  },
  acceptButton: {
    backgroundColor: '#00B894',
  },
  rejectButton: {
    backgroundColor: '#E74C3C',
  },
  endButton: {
    backgroundColor: '#E74C3C',
  },
  // Alert Modal
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,20,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  alertContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.xxl,
    alignItems: 'center',
    width: '85%',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  alertTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  alertMessage: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  alertButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.xl,
  },
  alertButtonText: {
    ...FONTS.button,
    color: COLORS.text,
    fontWeight: '600',
  },
});

export default FriendCallScreen;
