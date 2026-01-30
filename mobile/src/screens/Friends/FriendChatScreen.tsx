import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from '../../components/MessageBubble';
import ProfilePhoto from '../../components/ProfilePhoto';
import PhotoEditor from '../../components/PhotoEditor';
import VideoPreview from '../../components/VideoPreview';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

type Props = NativeStackScreenProps<any, 'FriendChat'>;

interface FriendMessage {
  id: string;
  senderId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: 'audio' | 'photo' | 'video' | null;
  isInstant?: boolean;
  createdAt: string;
  isSystem?: boolean;
  systemType?: 'gift' | 'info';
  systemData?: {
    fromNickname?: string;
    amount?: number;
  };
}

// Hediye seçenekleri
const GIFT_OPTIONS = [5, 10, 25, 50, 100];

const FriendChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { friendshipId, friendNickname, friendPhoto, friendOnline, friendId } =
    route.params || {};
  const { user, deductTokens, updateTokenBalance, addTokens, refreshProfile } = useAuth();
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [input, setInput] = useState('');
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [tokenGiftEnabled, setTokenGiftEnabled] = useState(true); // Feature flag
  const [tokenGiftDisabledMessage, setTokenGiftDisabledMessage] = useState('');
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [photoEditorVisible, setPhotoEditorVisible] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoIsInstant, setPendingPhotoIsInstant] = useState(false);
  const [videoPreviewVisible, setVideoPreviewVisible] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [pendingVideoIsInstant, setPendingVideoIsInstant] = useState(false);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const [pendingGiftAmount, setPendingGiftAmount] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Audio recorder hook
  const {
    isRecording,
    recordedUri,
    recordedDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  } = useAudioRecorder();
  
  const [audioPreviewVisible, setAudioPreviewVisible] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewSound, setPreviewSound] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Gift animation state
  const [giftAnimation, setGiftAnimation] = useState<{ visible: boolean; amount: number; type: 'sent' | 'received' }>({
    visible: false,
    amount: 0,
    type: 'sent',
  });
  const giftAnimValue = useRef(new Animated.Value(0)).current;

  // Hediye animasyonu göster
  const showGiftAnimation = useCallback((amount: number, type: 'sent' | 'received') => {
    setGiftAnimation({ visible: true, amount, type });
    giftAnimValue.setValue(0);
    
    Animated.sequence([
      Animated.spring(giftAnimValue, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(giftAnimValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setGiftAnimation({ visible: false, amount: 0, type: 'sent' });
    });
  }, [giftAnimValue]);

  // Recording pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  // Feature flags'ı yükle
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const res = await api.get('/api/features');
        if (res.data?.data) {
          setTokenGiftEnabled(res.data.data.tokenGiftEnabled);
          setTokenGiftDisabledMessage(res.data.data.tokenGiftDisabledMessage || 'Geçici olarak devre dışı');
        }
      } catch (error) {
        console.log('[FriendChatScreen] Failed to fetch features:', error);
      }
    };
    fetchFeatures();
  }, []);

  // Socket bağlantısı ve mesaj dinleyicileri
  useEffect(() => {
    const socket = getSocket();
    socket.emit('friend:join', { friendshipId });

    // Mevcut mesajları yükle
    loadMessages();

    socket.on('friend:message', (msg: FriendMessage & { friendChatId?: string }) => {
      if (msg.friendChatId !== friendshipId) return;
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    // Hediye alındığında - UI ve animasyon güncelle (bakiye AuthContext'te güncelleniyor)
    socket.on('friend:gift:received', (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number }) => {
      console.log('[FriendChat] Gift received:', payload);
      if (payload.fromUserId === friendId) {
        const systemMessage: FriendMessage = {
          id: `system-gift-${Date.now()}`,
          senderId: 'system',
          isSystem: true,
          systemType: 'gift',
          systemData: {
            fromNickname: payload.fromNickname,
            amount: payload.amount,
          },
          content: `🎁 ${payload.fromNickname} sana ${payload.amount} elmas gönderdi!`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);
        // Animasyon göster
        showGiftAnimation(payload.amount, 'received');
      }
      // Profili yenile - bakiyeyi veritabanından çek
      refreshProfile();
    });

    // Hediye gönderildiğinde - UI güncelle (bakiye AuthContext'te güncelleniyor)
    socket.on('friend:gift:sent', (payload: { toUserId: string; amount: number; newBalance: number }) => {
      console.log('[FriendChat] Gift sent:', payload);
      if (payload.toUserId === friendId) {
        const systemMessage: FriendMessage = {
          id: `system-gift-sent-${Date.now()}`,
          senderId: 'system',
          isSystem: true,
          systemType: 'gift',
          content: `💎 ${payload.amount} elmas gönderdin!`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);
      }
      // Profili yenile - bakiyeyi veritabanından çek
      refreshProfile();
    });

    // Hediye hatası - KILL SWITCH dahil
    socket.on('friend:gift:error', (payload: { code: string; message: string; disabled?: boolean }) => {
      console.log('[FriendChat] Gift error:', payload);
      if (payload.code === 'FEATURE_DISABLED' || payload.disabled) {
        setTokenGiftEnabled(false);
        setTokenGiftDisabledMessage(payload.message);
        Alert.alert('Bakım', payload.message);
      } else {
        Alert.alert('Hata', payload.message);
      }
    });

    return () => {
      socket.off('friend:message');
      socket.off('friend:gift:received');
      socket.off('friend:gift:sent');
      socket.off('friend:gift:error');
    };
  }, [friendshipId, friendId, showGiftAnimation]);

  // Mevcut mesajları API'den yükle
  const loadMessages = async () => {
    try {
      const res = await api.get(`/api/user/friends/${friendshipId}/messages`);
      if (res.data.success) {
        setMessages(res.data.data || []);
      }
    } catch (err) {
      console.error('Messages load error:', err);
    }
  };

  // Metin mesajı gönder
  const sendMessage = () => {
    if (!input.trim() || !user) return;
    const socket = getSocket();
    socket.emit('friend:message', {
      friendshipId,
      senderId: user.id,
      content: input.trim(),
    });
    setInput('');
  };

  // ============ SES KAYDI ============
  const handleAudioTap = async () => {
    if (isRecording) {
      const audioUri = await stopRecording();
      if (audioUri) {
        setAudioPreviewVisible(true);
      }
    } else {
      await startRecording();
    }
  };

  const handleCancelRecording = async () => {
    await cancelRecording();
  };

  const handleConfirmSendAudio = async () => {
    if (!recordedUri) return;
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: recordedUri,
        type: 'audio/m4a',
        name: `audio_${Date.now()}.m4a`,
      } as any);

      const apiBaseUrl = api.defaults.baseURL || 'http://localhost:3000';
      const response = await fetch(`${apiBaseUrl}/api/upload/audio`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      const socket = getSocket();
      socket.emit('friend:media', {
        friendshipId,
        senderId: user?.id,
        mediaType: 'audio',
        mediaUrl: data.url,
        duration: recordedDuration,
      });
      
      clearRecording();
      setAudioPreviewVisible(false);
    } catch (error) {
      console.error('Audio upload error:', error);
      Alert.alert('Hata', 'Ses dosyası yüklenemedi.');
    }
  };

  const handleDiscardAudio = async () => {
    // Önce oynatmayı durdur
    if (previewSound) {
      await previewSound.unloadAsync();
      setPreviewSound(null);
    }
    setIsPreviewPlaying(false);
    clearRecording();
    setAudioPreviewVisible(false);
  };

  // Ses kaydı önizleme - Dinle/Durdur
  const handlePreviewAudio = async () => {
    if (!recordedUri) return;

    try {
      if (isPreviewPlaying && previewSound) {
        // Durdur
        await previewSound.pauseAsync();
        setIsPreviewPlaying(false);
      } else if (previewSound) {
        // Devam et
        await previewSound.playAsync();
        setIsPreviewPlaying(true);
      } else {
        // Yeni ses yükle ve oynat
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: recordedUri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPreviewPlaying(false);
            }
          }
        );
        setPreviewSound(sound);
        setIsPreviewPlaying(true);
      }
    } catch (error) {
      console.error('Preview audio error:', error);
      Alert.alert('Hata', 'Ses dinlenemedi.');
    }
  };

  // ============ FOTOĞRAF ============
  const handleSendPhoto = () => {
    Alert.alert(
      'Fotoğraf Gönder',
      'Nasıl göndermek istiyorsunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: '📷 Anlık Çek', onPress: () => pickPhotoFromCamera(true) },
        { text: '🖼️ Galeriden', onPress: () => pickPhotoFromGallery(false) },
      ],
    );
  };

  // Fotoğraf seç ve editöre gönder
  const pickPhotoFromCamera = async (isInstant: boolean) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Kamera izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // Editöre gönder
      setPendingPhotoUri(result.assets[0].uri);
      setPendingPhotoIsInstant(isInstant);
      setPhotoEditorVisible(true);
    }
  };

  const pickPhotoFromGallery = async (isInstant: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // Editöre gönder
      setPendingPhotoUri(result.assets[0].uri);
      setPendingPhotoIsInstant(isInstant);
      setPhotoEditorVisible(true);
    }
  };

  // Fotoğraf düzenleme tamamlandığında
  const handlePhotoEdited = (editedUri: string) => {
    setPhotoEditorVisible(false);
    uploadAndSendMedia(editedUri, 'photo', pendingPhotoIsInstant);
    setPendingPhotoUri(null);
  };

  // Fotoğraf düzenleme iptal
  const handlePhotoEditorClose = () => {
    setPhotoEditorVisible(false);
    setPendingPhotoUri(null);
  };

  // ============ VİDEO ============
  const handleSendVideo = () => {
    Alert.alert(
      'Video Gönder',
      'Nasıl göndermek istiyorsunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: '🎥 Anlık Çek', onPress: () => pickVideoFromCamera(true) },
        { text: '📁 Galeriden', onPress: () => pickVideoFromGallery(false) },
      ],
    );
  };

  // Video seç ve önizlemeye gönder
  const pickVideoFromCamera = async (isInstant: boolean) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Kamera izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Önizlemeye gönder
      setPendingVideoUri(result.assets[0].uri);
      setPendingVideoIsInstant(isInstant);
      setVideoPreviewVisible(true);
    }
  };

  const pickVideoFromGallery = async (isInstant: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Önizlemeye gönder
      setPendingVideoUri(result.assets[0].uri);
      setPendingVideoIsInstant(isInstant);
      setVideoPreviewVisible(true);
    }
  };

  // Video gönder
  const handleVideoSend = () => {
    if (pendingVideoUri) {
      setVideoPreviewVisible(false);
      uploadAndSendMedia(pendingVideoUri, 'video', pendingVideoIsInstant);
      setPendingVideoUri(null);
    }
  };

  // Video önizleme iptal
  const handleVideoPreviewClose = () => {
    setVideoPreviewVisible(false);
    setPendingVideoUri(null);
  };

  // Medya upload ve gönder
  const uploadAndSendMedia = async (uri: string, type: 'photo' | 'video', isInstant: boolean) => {
    try {
      const formData = new FormData();
      const extension = type === 'photo' ? 'jpg' : 'mp4';
      const mimeType = type === 'photo' ? 'image/jpeg' : 'video/mp4';
      
      // Server 'photo' veya 'video' field name bekliyor
      formData.append(type, {
        uri,
        type: mimeType,
        name: `${type}_${Date.now()}.${extension}`,
      } as any);

      const apiBaseUrl = api.defaults.baseURL || 'http://localhost:3000';
      const endpoint = type === 'photo' ? '/api/upload/photo' : '/api/upload/video';
      
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();

      const socket = getSocket();
      socket.emit('friend:media', {
        friendshipId,
        senderId: user?.id,
        mediaType: type,
        mediaUrl: data.url,
        isInstant,
      });
      
      Alert.alert('Başarılı', `${type === 'photo' ? 'Fotoğraf' : 'Video'} gönderildi!`);
    } catch (error) {
      console.error(`${type} upload error:`, error);
      Alert.alert('Hata', `${type === 'photo' ? 'Fotoğraf' : 'Video'} yüklenemedi.`);
    }
  };

  // ============ HEDİYE ELMAS ============
  const handleSendGift = (amount: number, skipBalanceCheck = false) => {
    if (!user) return;
    
    // 🔴 KILL SWITCH: Feature devre dışıysa uyar
    if (!tokenGiftEnabled) {
      Alert.alert('Bakım', tokenGiftDisabledMessage || 'Jeton sistemi geçici olarak kapalı.');
      setGiftModalVisible(false);
      return;
    }
    
    if (!skipBalanceCheck && (user.tokenBalance || 0) < amount) {
      // Yetersiz bakiye - satın alma ekranını göster
      setPendingGiftAmount(amount);
      setGiftModalVisible(false);
      setPurchaseModalVisible(true);
      return;
    }

    const socket = getSocket();
    socket.emit('friend:gift', {
      fromUserId: user.id,
      toUserId: friendId,
      friendshipId,
      amount,
    });
    
    // Animasyonlu gösterim
    showGiftAnimation(amount, 'sent');
    setGiftModalVisible(false);
  };

  // Hızlı satın alma sonrası hediye gönder
  const handlePurchaseComplete = async (purchasedAmount: number) => {
    const giftAmount = pendingGiftAmount; // Önce kaydet
    setPurchaseModalVisible(false);
    setPendingGiftAmount(0);
    
    try {
      // API ile veritabanına token ekle
      const res = await api.post('/api/user/purchase-tokens', { amount: purchasedAmount });
      
      if (res.data.success) {
        // Local state'i de güncelle
        updateTokenBalance(res.data.data.newBalance);
        
        Alert.alert('Satın Alma Başarılı', `${purchasedAmount} elmas hesabınıza eklendi!`, [
          { 
            text: 'Hediye Gönder', 
            onPress: () => {
              if (giftAmount > 0) {
                // Bakiye kontrolü yapmadan gönder (skipBalanceCheck=true)
                setTimeout(() => handleSendGift(giftAmount, true), 300);
              }
            }
          },
          { text: 'Tamam' }
        ]);
      } else {
        Alert.alert('Hata', 'Satın alma başarısız oldu.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Hata', 'Satın alma sırasında bir hata oluştu.');
    }
  };

  // ============ ARAMA ============
  const handleVoiceCall = () => {
    Alert.alert(
      'Sesli Arama',
      `${friendNickname} ile sesli arama başlatılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ara', onPress: () => startCall('voice') },
      ]
    );
  };

  const handleVideoCall = () => {
    Alert.alert(
      'Görüntülü Arama',
      `${friendNickname} ile görüntülü arama başlatılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ara', onPress: () => startCall('video') },
      ]
    );
  };

  const startCall = (type: 'voice' | 'video') => {
    const socket = getSocket();
    socket.emit('friend:call:start', {
      fromUserId: user?.id,
      toUserId: friendId,
      friendshipId,
      callType: type,
    });
    
    // Navigate to call screen
    navigation.navigate('FriendCall', {
      friendshipId,
      friendNickname,
      friendPhoto,
      friendId,
      callType: type,
      isIncoming: false,
    });
  };

  // ============ PROFİL GÖRÜNTÜLE ============
  const handleViewProfile = () => {
    navigation.navigate('FriendProfile', {
      friendId,
      friendNickname,
    });
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.profileInfo} onPress={handleViewProfile}>
            <ProfilePhoto
              uri={friendPhoto || ''}
              size={40}
              online={friendOnline}
            />
            <View style={styles.headerTextContainer}>
              <Text style={FONTS.h3}>{friendNickname}</Text>
              <Text style={FONTS.caption}>
                {friendOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Call buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleVoiceCall} style={styles.headerButton}>
              <Ionicons name="call" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleVideoCall} style={styles.headerButton}>
              <Ionicons name="videocam" size={22} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.senderId === user?.id}
              isUnlocked={true} // Arkadaş sohbetinde tüm medyalar açık
              isFirstFreeView={false} // Kilitleme sistemi yok
              photoIndex={0}
            />
          )}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Gift Animation Overlay */}
        {giftAnimation.visible && (
          <Animated.View 
            style={[
              styles.giftAnimationOverlay,
              {
                opacity: giftAnimValue,
                transform: [
                  { scale: giftAnimValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }) },
                ],
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.giftAnimationBox}>
              <Text style={styles.giftAnimationEmoji}>
                {giftAnimation.type === 'sent' ? '💎' : '🎁'}
              </Text>
              <Text style={styles.giftAnimationAmount}>
                {giftAnimation.type === 'sent' ? '-' : '+'}{giftAnimation.amount}
              </Text>
              <Text style={styles.giftAnimationText}>
                {giftAnimation.type === 'sent' ? 'Elmas Gönderildi!' : 'Elmas Alındı!'}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Audio Preview Modal */}
        {audioPreviewVisible && (
          <View style={styles.audioPreview}>
            <View style={styles.audioPreviewInfo}>
              <TouchableOpacity onPress={handlePreviewAudio} style={styles.audioPlayBtn}>
                <Ionicons 
                  name={isPreviewPlaying ? 'pause' : 'play'} 
                  size={24} 
                  color={COLORS.text} 
                />
              </TouchableOpacity>
              <Text style={styles.audioPreviewText}>
                🎤 {formatDuration(recordedDuration)}
              </Text>
            </View>
            <View style={styles.audioPreviewActions}>
              <TouchableOpacity onPress={handleDiscardAudio} style={styles.audioDiscardBtn}>
                <Ionicons name="trash" size={20} color={COLORS.error} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmSendAudio} style={styles.audioSendBtn}>
                <Ionicons name="send" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputContainer}>
          {/* Media buttons */}
          <View style={styles.mediaButtons}>
            <TouchableOpacity onPress={handleSendPhoto} style={styles.mediaButton}>
              <Ionicons name="image" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendVideo} style={styles.mediaButton}>
              <Ionicons name="videocam" size={24} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setGiftModalVisible(true)} style={styles.mediaButton}>
              <Ionicons name="diamond" size={24} color="#9B59B6" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            {/* Audio button */}
            {isRecording ? (
              <TouchableOpacity onPress={handleCancelRecording} style={styles.cancelButton}>
                <Ionicons name="close" size={20} color={COLORS.error} />
              </TouchableOpacity>
            ) : null}

            <Animated.View style={[
              styles.audioButton,
              isRecording && { transform: [{ scale: pulseAnim }] }
            ]}>
              <TouchableOpacity
                onPress={handleAudioTap}
                style={[styles.audioTouchable, isRecording && styles.audioRecording]}
              >
                <Ionicons name="mic" size={22} color={isRecording ? COLORS.error : COLORS.text} />
              </TouchableOpacity>
            </Animated.View>

            <TextInput
              style={styles.input}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor={COLORS.textMuted}
              value={input}
              onChangeText={setInput}
              editable={!isRecording}
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={isRecording}>
              <Ionicons name="send" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gift Modal */}
        <Modal visible={giftModalVisible} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setGiftModalVisible(false)}
          >
            <View style={styles.giftModal}>
              <Text style={styles.giftTitle}>💎 Elmas Gönder</Text>
              <Text style={styles.giftSubtitle}>
                Arkadaşına elmas hediye et!{'\n'}
                <Text style={styles.sparkNote}>✨ Arkadaş hediyeleri Spark'a yansır!</Text>
              </Text>
              <View style={styles.giftOptions}>
                {GIFT_OPTIONS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={styles.giftOption}
                    onPress={() => handleSendGift(amount)}
                  >
                    <Text style={styles.giftAmount}>💎 {amount}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.balanceText}>
                Bakiye: 💎 {user?.tokenBalance || 0}
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Photo Editor */}
        {pendingPhotoUri && (
          <PhotoEditor
            visible={photoEditorVisible}
            imageUri={pendingPhotoUri}
            onClose={handlePhotoEditorClose}
            onSave={handlePhotoEdited}
          />
        )}

        {/* Video Preview */}
        {pendingVideoUri && (
          <VideoPreview
            visible={videoPreviewVisible}
            videoUri={pendingVideoUri}
            onClose={handleVideoPreviewClose}
            onSend={handleVideoSend}
          />
        )}

        {/* Hızlı Satın Alma Modal */}
        <Modal visible={purchaseModalVisible} transparent animationType="fade">
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setPurchaseModalVisible(false)}
          >
            <View style={styles.purchaseModal}>
              <Text style={styles.purchaseTitle}>💎 Elmas Satın Al</Text>
              <Text style={styles.purchaseSubtitle}>
                Hediye göndermek için yeterli bakiyeniz yok.{'\n'}
                Gerekli: {pendingGiftAmount} 💎 | Mevcut: {user?.tokenBalance || 0} 💎
              </Text>
              <View style={styles.purchaseOptions}>
                <TouchableOpacity
                  style={styles.purchaseOption}
                  onPress={() => handlePurchaseComplete(50)}
                >
                  <Text style={styles.purchaseAmount}>💎 50</Text>
                  <Text style={styles.purchasePrice}>₺29.99</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.purchaseOption}
                  onPress={() => handlePurchaseComplete(100)}
                >
                  <Text style={styles.purchaseAmount}>💎 100</Text>
                  <Text style={styles.purchasePrice}>₺49.99</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.purchaseOption, styles.purchasePopular]}
                  onPress={() => handlePurchaseComplete(250)}
                >
                  <Text style={styles.purchasePopularBadge}>Popüler</Text>
                  <Text style={styles.purchaseAmount}>💎 250</Text>
                  <Text style={styles.purchasePrice}>₺99.99</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.purchaseOption}
                  onPress={() => handlePurchaseComplete(500)}
                >
                  <Text style={styles.purchaseAmount}>💎 500</Text>
                  <Text style={styles.purchasePrice}>₺179.99</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity 
                style={styles.purchaseCancel}
                onPress={() => setPurchaseModalVisible(false)}
              >
                <Text style={styles.purchaseCancelText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  backButton: {
    padding: SPACING.xs,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.sm,
    gap: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  headerButton: {
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.lg,
  },
  mediaButton: {
    padding: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  audioButton: {
    marginRight: SPACING.xs,
  },
  audioTouchable: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioRecording: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  cancelButton: {
    padding: SPACING.xs,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: SPACING.sm,
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: 12,
  },
  audioPreviewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioPreviewText: {
    color: COLORS.text,
    fontSize: 14,
  },
  audioPreviewActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  audioDiscardBtn: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 20,
  },
  audioSendBtn: {
    padding: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    width: '85%',
    alignItems: 'center',
  },
  giftTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  giftSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  sparkNote: {
    color: COLORS.accent,
    fontSize: 12,
  },
  giftOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  giftOption: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
  },
  giftAmount: {
    ...FONTS.button,
    color: COLORS.text,
  },
  balanceText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  // Hızlı Satın Alma Modal
  purchaseModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    width: '90%',
    alignItems: 'center',
  },
  purchaseTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  purchaseSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  purchaseOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  purchaseOption: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    minWidth: 100,
  },
  purchasePopular: {
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  purchasePopularBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#FFD700',
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  purchaseAmount: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: 4,
  },
  purchasePrice: {
    ...FONTS.caption,
    color: COLORS.text,
    opacity: 0.8,
  },
  purchaseCancel: {
    paddingVertical: SPACING.sm,
  },
  purchaseCancelText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  // Gift Animation
  giftAnimationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  giftAnimationBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    minWidth: 200,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },
  giftAnimationEmoji: {
    fontSize: 64,
    marginBottom: SPACING.sm,
  },
  giftAnimationAmount: {
    ...FONTS.h1,
    color: COLORS.accent,
    fontSize: 36,
  },
  giftAnimationText: {
    ...FONTS.body,
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
});

export default FriendChatScreen;
