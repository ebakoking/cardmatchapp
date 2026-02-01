import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Vibration,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from '../../components/MessageBubble';
import PhotoViewModal from '../../components/PhotoViewModal';
import VideoPreview from '../../components/VideoPreview';
import PhotoEditor from '../../components/PhotoEditor';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Stage bazlı özellik kilitleri
const FEATURE_UNLOCKS = {
  gift: 1,
  audio: 2,
  photo: 3,
  video: 4,
  friend: 5,
};

// Stage ikonları ve renkleri
const STAGE_CONFIG = {
  1: { icon: 'chatbubble', label: 'Yazı', color: COLORS.accent },
  2: { icon: 'mic', label: 'Ses', color: '#9b59b6' },
  3: { icon: 'camera', label: 'Foto', color: '#e74c3c' },
  4: { icon: 'videocam', label: 'Video', color: '#f39c12' },
  5: { icon: 'people', label: 'Arkadaş', color: '#2ecc71' },
};

// Elmas maliyetleri
const ELMAS_COSTS = {
  viewAudio: 5,
  viewPhoto: 20,
  viewVideo: 50,
};

// Token gönderim seçenekleri
const GIFT_OPTIONS = [
  { amount: 10, emoji: '💎', label: '10' },
  { amount: 50, emoji: '💎💎', label: '50' },
  { amount: 100, emoji: '💎💎💎', label: '100' },
];

// Hızlı satın alma seçenekleri
const PURCHASE_OPTIONS = [
  { tokens: 50, price: '₺29.90', popular: false },
  { tokens: 100, price: '₺49.90', popular: true },
  { tokens: 500, price: '₺199.90', popular: false },
];

interface ChatMessage {
  id: string;
  senderId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  messageType?: 'TEXT' | 'MEDIA' | 'TOKEN_GIFT' | 'SYSTEM';
  tokenAmount?: number;
  senderNickname?: string;
  receiverId?: string;
  receiverNickname?: string;
  isInstant?: boolean;
  isViewed?: boolean;
  createdAt?: string;
  isSystem?: boolean;
  systemType?: 'gift' | 'stage' | 'info' | 'friend';
  systemData?: {
    fromNickname?: string;
    amount?: number;
    newStage?: number;
  };
  // YENİ: Medya kilitleme sistemi
  locked?: boolean;      // Medya kilitli mi?
  isFirstFree?: boolean; // Bu gönderenin ilk medyası mı?
  mediaPrice?: number;   // Açma maliyeti (photo:20, video:50, audio:5)
}

// Stage süreleri
const STAGE_DURATION = 10; // TEST: 10 saniye
const STAGE_THRESHOLDS = [0, 10, 20, 30, 40];

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, partnerNickname, partnerId } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(STAGE_DURATION);
  const [sessionStartTime] = useState(Date.now());
  const [isEnded, setIsEnded] = useState(false);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [tokenGiftEnabled, setTokenGiftEnabled] = useState(true);
  const [tokenGiftDisabledMessage, setTokenGiftDisabledMessage] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Değerlendirme modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [chatEndReason, setChatEndReason] = useState('');
  
  // Block/Report menü state
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');
  
  // Photo view modal state
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<ChatMessage | null>(null);
  const [isCurrentMediaFirstFree, setIsCurrentMediaFirstFree] = useState(false);
  const [isMediaAlreadyPaid, setIsMediaAlreadyPaid] = useState(false);
  
  // Görüntülenen medyalar (ephemeral tracking)
  const [viewedMediaIds, setViewedMediaIds] = useState<Set<string>>(new Set());
  const [listenedAudioIds, setListenedAudioIds] = useState<Set<string>>(new Set());

  // Animasyonlar
  const typingAnimation = useRef(new Animated.Value(0)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // Video önizleme state
  const [videoPreviewVisible, setVideoPreviewVisible] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);

  // Fotoğraf düzenleme state
  const [photoEditorVisible, setPhotoEditorVisible] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoIsInstant, setPendingPhotoIsInstant] = useState(false);

  // FlatList ref
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ses kaydı hook
  const {
    isRecording,
    recordingDuration,
    recordedUri,
    recordedDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
    playPreview,
    stopPreview,
    isPlayingPreview,
  } = useAudioRecorder();
  
  const [audioPreviewVisible, setAudioPreviewVisible] = useState(false);

  // Başlangıç animasyonu
  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Typing animasyonu
  useEffect(() => {
    if (isPartnerTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingAnimation.setValue(0);
    }
  }, [isPartnerTyping]);

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
        console.log('[ChatScreen] Failed to fetch features:', error);
      }
    };
    fetchFeatures();
  }, []);

  // Özellik kilitli mi kontrolü
  const isFeatureLocked = (feature: keyof typeof FEATURE_UNLOCKS) => {
    return stage < FEATURE_UNLOCKS[feature];
  };

  // Home ekranına dön
  const goToHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'HomeMain' }],
      }),
    );
  };

  // Kullanıcıyı engelle
  const handleBlockUser = async () => {
    Alert.alert(
      'Kullanıcıyı Engelle',
      `${partnerNickname} kullanıcısını engellemek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/user/block', { blockedUserId: partnerId });
              Vibration.vibrate(100);
              Alert.alert('Engellendi', `${partnerNickname} engellendi.`);
              setMenuModalVisible(false);
              goToHome();
            } catch (error) {
              Alert.alert('Hata', 'Engelleme işlemi başarısız oldu.');
            }
          },
        },
      ],
    );
  };

  // Kullanıcıyı raporla
  const handleReportUser = async () => {
    if (!reportCategory) {
      Alert.alert('Hata', 'Lütfen bir rapor kategorisi seçin.');
      return;
    }
    try {
      await api.post('/api/user/report', {
        reportedUserId: partnerId,
        category: reportCategory,
        description: reportDescription,
        sessionId: sessionId,
      });
      Vibration.vibrate(50);
      Alert.alert('Rapor Gönderildi', 'Raporunuz incelenecektir.');
      setReportModalVisible(false);
      setReportCategory('');
      setReportDescription('');
      setMenuModalVisible(false);
    } catch (error) {
      Alert.alert('Hata', 'Rapor gönderilemedi.');
    }
  };

  // Kullanıcıyı beğen (iyi kullanıcı)
  const handleLikeUser = async () => {
    try {
      const socket = getSocket();
      socket.emit('user:like', {
        fromUserId: user?.id,
        toUserId: partnerId,
        sessionId,
      });
      Vibration.vibrate([0, 50, 100, 50]);
      Alert.alert('Beğenildi', `${partnerNickname} için olumlu geri bildirim gönderildi.`);
      setMenuModalVisible(false);
    } catch (error) {
      Alert.alert('Hata', 'İşlem başarısız oldu.');
    }
  };

  // Değerlendirme gönder
  const handleRating = async (rating: 'like' | 'skip') => {
    if (rating === 'like') {
      const socket = getSocket();
      socket.emit('user:like', {
        fromUserId: user?.id,
        toUserId: partnerId,
        sessionId,
      });
    }
    setRatingModalVisible(false);
    goToHome();
  };

  // Input değiştiğinde typing event gönder
  const handleInputChange = (text: string) => {
    setInput(text);
    
    const socket = getSocket();
    socket.emit('chat:typing', { sessionId, userId: user?.id, isTyping: true });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { sessionId, userId: user?.id, isTyping: false });
    }, 2000);
  };

  useEffect(() => {
    const socket = getSocket();
    socket.emit('chat:join', { sessionId, userId: user?.id });

    socket.on('chat:message', (msg: ChatMessage & { chatSessionId?: string }) => {
      if (msg.chatSessionId && msg.chatSessionId !== sessionId) return;
      setMessages((prev) => [...prev, msg]);
      if (msg.senderId !== user?.id) {
        Vibration.vibrate(30);
      }
    });

    socket.on('chat:typing', (payload: { userId: string; isTyping: boolean }) => {
      if (payload.userId !== user?.id) {
        setIsPartnerTyping(payload.isTyping);
      }
    });

    socket.on('stage:advanced', (payload: { newStage: number; features: string[] }) => {
      console.log('[ChatScreen] stage:advanced from server:', payload);
      setStage(payload.newStage);
      Vibration.vibrate([0, 50, 100, 50]);
    });

    socket.on('chat:ended', (payload: { sessionId: string; reason: string; message: string }) => {
      console.log('[ChatScreen] chat:ended received:', payload);
      if (payload.sessionId !== sessionId) return;
      if (isEnded) return;
      setIsEnded(true);
      setChatEndReason(payload.reason);
      
      // Değerlendirme modalını göster
      if (payload.reason !== 'self') {
        Vibration.vibrate(200);
        setRatingModalVisible(true);
      }
    });

    // NOT: Balance güncellemesi AuthContext'te yapılıyor - burada duplicate yapmıyoruz
    socket.on('gift:received', (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number; messageId: string }) => {
      console.log('[ChatScreen] gift:received - vibration only (balance via AuthContext)');
      Vibration.vibrate([0, 100, 50, 100]);
    });

    socket.on('gift:sent', (payload: { toUserId: string; amount: number; newBalance: number; messageId: string }) => {
      console.log('[ChatScreen] gift:sent - no action needed (balance via AuthContext)');
      // AuthContext handles balance update
    });

    // DEBUG: Media view response listeners
    socket.on('media:viewed', (payload: any) => {
      console.log('========================================');
      console.log('[ChatScreen] DEBUG media:viewed received:', payload);
      console.log('========================================');
    });
    
    socket.on('token:spent', (payload: any) => {
      console.log('========================================');
      console.log('[ChatScreen] DEBUG token:spent received:', payload);
      console.log('========================================');
    });
    
    socket.on('error', (payload: any) => {
      console.log('========================================');
      console.log('[ChatScreen] DEBUG socket error received:', payload);
      console.log('========================================');
    });

    socket.on('gift:error', (payload: { code: string; message: string; balance?: number; required?: number; disabled?: boolean }) => {
      console.log('[ChatScreen] gift:error:', payload);
      
      if (payload.code === 'FEATURE_DISABLED' || payload.disabled) {
        setTokenGiftEnabled(false);
        setTokenGiftDisabledMessage(payload.message);
        Alert.alert('Bakım', payload.message);
        return;
      }
      
      if (payload.code === 'INSUFFICIENT_BALANCE') {
        Alert.alert(
          'Yetersiz Bakiye',
          `${payload.required} elmas gerekiyor.\nBakiyeniz: ${payload.balance || 0}`,
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Elmas Satın Al', onPress: () => setGiftModalVisible(true) },
          ],
        );
      } else {
        Alert.alert('Hata', payload.message);
      }
    });

    socket.on('friend:info', (payload: { message: string }) => {
      console.log('[ChatScreen] friend:info:', payload);
      Alert.alert('Arkadaşlık', payload.message);
    });

    socket.on('friend:accepted', (payload: { friendshipId: string; user1Id: string; user2Id: string }) => {
      console.log('[ChatScreen] friend:accepted:', payload);
      if (payload.user1Id === user?.id || payload.user2Id === user?.id) {
        setFriendRequestSent(true);
        Vibration.vibrate([0, 100, 50, 100, 50, 100]);
        const systemMessage: ChatMessage = {
          id: `system-friend-${Date.now()}`,
          senderId: 'system',
          isSystem: true,
          systemType: 'friend',
          content: `🎉 Artık arkadaşsınız!`,
        };
        setMessages((prev) => [...prev, systemMessage]);
      }
    });

    return () => {
      console.log('[ChatScreen] Cleanup - emitting chat:leave');
      socket.emit('chat:leave', { sessionId, userId: user?.id });
      socket.off('chat:message');
      socket.off('chat:typing');
      socket.off('stage:advanced');
      socket.off('chat:ended');
      socket.off('gift:received');
      socket.off('gift:sent');
      socket.off('gift:error');
      socket.off('friend:info');
      socket.off('friend:accepted');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [sessionId, user?.id]);

  // Otomatik stage geçişi ve timer
  useEffect(() => {
    const socket = getSocket();
    
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
      
      let newStage = 1;
      for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (elapsedSeconds >= STAGE_THRESHOLDS[i]) {
          newStage = i + 1;
          break;
        }
      }
      
      if (newStage > 5) newStage = 5;
      
      if (newStage !== stage && newStage <= 5) {
        console.log(`[ChatScreen] Stage changed: ${stage} -> ${newStage}`);
        setStage(newStage);
        socket.emit('stage:advance', { sessionId, stage: newStage });
      }
      
      if (newStage < 5) {
        const stageStartTime = STAGE_THRESHOLDS[newStage - 1];
        const nextStageTime = STAGE_THRESHOLDS[newStage] || STAGE_THRESHOLDS[newStage - 1] + STAGE_DURATION;
        const remaining = Math.max(0, nextStageTime - elapsedSeconds);
        setTimeRemaining(remaining);
      } else {
        setTimeRemaining(0);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionStartTime, stage, sessionId]);

  // Yeni mesaj gelince otomatik scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = () => {
    if (!input.trim() || !user || isEnded) return;
    
    Animated.sequence([
      Animated.timing(sendButtonScale, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(sendButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    Vibration.vibrate(20);
    
    const socket = getSocket();
    socket.emit('chat:message', {
      sessionId,
      senderId: user.id,
      content: input.trim(),
    });
    socket.emit('chat:typing', { sessionId, userId: user?.id, isTyping: false });
    setInput('');
  };

  // Sohbetten çık
  const handleLeaveChat = () => {
    Alert.alert(
      'Sohbetten Çık',
      'Sohbetten çıkmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çık',
          style: 'destructive',
          onPress: () => {
            console.log('[ChatScreen] User clicked leave');
            setIsEnded(true);
            const socket = getSocket();
            socket.emit('chat:leave', { sessionId, userId: user?.id });
            // Değerlendirme modalını göster
            setRatingModalVisible(true);
          },
        },
      ],
    );
  };

  // Dosya yükleme fonksiyonu
  const uploadFile = async (uri: string, type: 'photo' | 'video'): Promise<string | null> => {
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      const ext = type === 'video' ? '.mp4' : '.jpg';
      const mimeType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      
      formData.append(type, {
        uri: uri,
        type: mimeType,
        name: `${type}_${Date.now()}${ext}`,
      } as any);

      const apiBaseUrl = api.defaults.baseURL || 'http://localhost:3000';
      console.log(`[ChatScreen] Uploading ${type} to ${apiBaseUrl}/api/upload/${type}`);
      
      const response = await fetch(`${apiBaseUrl}/api/upload/${type}`, {
        method: 'POST',
        body: formData,
        // Content-Type header'ı FormData için otomatik ayarlanır - manuel ayarlamayın!
      });

      console.log(`[ChatScreen] Upload response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ChatScreen] Upload error: ${errorText}`);
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log(`[ChatScreen] ${type} uploaded successfully:`, data.url);
      setIsUploading(false);
      return data.url;
    } catch (error) {
      console.error(`[ChatScreen] ${type} upload error:`, error);
      setIsUploading(false);
      return null;
    }
  };

  // Fotoğraf gönder
  const handleSendPhoto = () => {
    if (isFeatureLocked('photo')) {
      Vibration.vibrate(100);
      Alert.alert('Kilitli', `Fotoğraf göndermek için Seviye ${FEATURE_UNLOCKS.photo}'e ulaşmalısınız.`);
      return;
    }

    Alert.alert(
      'Fotoğraf Gönder',
      'Nasıl göndermek istiyorsunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: '📷 Anlık Çek', onPress: () => sendPhotoFromCamera(true) },
        { text: '🖼️ Galeriden', onPress: () => sendPhotoFromGallery(false) },
      ],
    );
  };

  const sendPhotoFromCamera = async (isInstant: boolean) => {
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
      // Düzenleme ekranına gönder
      setPendingPhotoUri(result.assets[0].uri);
      setPendingPhotoIsInstant(isInstant);
      setPhotoEditorVisible(true);
    }
  };

  const sendPhotoFromGallery = async (isInstant: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      // Düzenleme ekranına gönder
      setPendingPhotoUri(result.assets[0].uri);
      setPendingPhotoIsInstant(isInstant);
      setPhotoEditorVisible(true);
    }
  };

  // Fotoğraf düzenleme tamamlandı
  const handlePhotoEditorSave = async (editedUri: string) => {
    setPhotoEditorVisible(false);
    await sendPhoto(editedUri, pendingPhotoIsInstant);
    setPendingPhotoUri(null);
  };

  // Fotoğraf düzenleme iptal
  const handlePhotoEditorClose = () => {
    setPhotoEditorVisible(false);
    setPendingPhotoUri(null);
  };

  const sendPhoto = async (uri: string, isInstant: boolean) => {
    // Önce dosyayı yükle
    const uploadedUrl = await uploadFile(uri, 'photo');
    
    if (!uploadedUrl) {
      Alert.alert('Hata', 'Fotoğraf yüklenemedi. Lütfen tekrar deneyin.');
      return;
    }

    Vibration.vibrate(30);
    const socket = getSocket();
    socket.emit('media:photo', {
      sessionId,
      senderId: user?.id,
      url: uploadedUrl,
      isInstant,
    });
  };

  // Video gönder
  const handleSendVideo = async () => {
    if (isFeatureLocked('video')) {
      Vibration.vibrate(100);
      Alert.alert('Kilitli', `Video göndermek için Seviye ${FEATURE_UNLOCKS.video}'ye ulaşmalısınız.`);
      return;
    }

    Alert.alert(
      'Video Gönder',
      'Nasıl göndermek istiyorsunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: '🎥 Çek', onPress: () => pickVideoFromCamera() },
        { text: '📁 Galeriden', onPress: () => pickVideoFromGallery() },
      ],
    );
  };

  const pickVideoFromCamera = async () => {
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
      setPendingVideoUri(result.assets[0].uri);
      setVideoPreviewVisible(true);
    }
  };

  const pickVideoFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Video süresi kontrolü (30 saniye max)
      const asset = result.assets[0];
      const durationSeconds = asset.duration ? asset.duration / 1000 : 0;
      
      if (durationSeconds > 30) {
        Alert.alert(
          'Video Çok Uzun',
          `Video süresi ${Math.floor(durationSeconds)} saniye. Maksimum 30 saniye olmalı.`,
          [{ text: 'Tamam' }]
        );
        return;
      }
      
      setPendingVideoUri(asset.uri);
      setVideoPreviewVisible(true);
    }
  };

  const handleVideoSend = async () => {
    if (!pendingVideoUri) return;
    
    setVideoPreviewVisible(false);
    
    // Önce dosyayı yükle
    const uploadedUrl = await uploadFile(pendingVideoUri, 'video');
    
    if (!uploadedUrl) {
      Alert.alert('Hata', 'Video yüklenemedi. Lütfen tekrar deneyin.');
      setPendingVideoUri(null);
      return;
    }

    Vibration.vibrate(30);
    const socket = getSocket();
    socket.emit('media:video', {
      sessionId,
      senderId: user?.id,
      url: uploadedUrl,
    });
    
    setPendingVideoUri(null);
  };

  const handleVideoPreviewClose = () => {
    setVideoPreviewVisible(false);
    setPendingVideoUri(null);
  };

  // Arkadaş ekle
  const handleAddFriend = () => {
    if (isFeatureLocked('friend')) {
      Vibration.vibrate(100);
      Alert.alert('Kilitli', `Arkadaş eklemek için Seviye ${FEATURE_UNLOCKS.friend}'e ulaşmalısınız.`);
      return;
    }

    if (friendRequestSent) {
      Alert.alert('Bilgi', 'Arkadaşlık isteği zaten gönderildi.');
      return;
    }

    const socket = getSocket();
    socket.emit('friend:request', {
      fromUserId: user?.id,
      toUserId: partnerId,
      sessionId,
    });
    setFriendRequestSent(true);
    Vibration.vibrate(50);
    Alert.alert('Başarılı', 'Arkadaşlık isteği gönderildi!');
  };

  // Ses kaydı
  const handleAudioTap = async () => {
    if (isFeatureLocked('audio')) {
      Vibration.vibrate(100);
      Alert.alert('Kilitli', `Ses göndermek için Seviye ${FEATURE_UNLOCKS.audio}'e ulaşmalısınız.`);
      return;
    }

    if (isRecording) {
      const audioUri = await stopRecording();
      if (audioUri) {
        setAudioPreviewVisible(true);
      }
    } else {
      Vibration.vibrate(30);
      await startRecording();
    }
  };

  const handleCancelRecording = async () => {
    await cancelRecording();
  };

  const handleConfirmSendAudio = async () => {
    if (!recordedUri) return;

    console.log('[ChatScreen] Uploading audio:', recordedUri);
    
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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('[ChatScreen] Audio uploaded:', data);

      const socket = getSocket();
      socket.emit('media:audio', {
        sessionId,
        senderId: user?.id,
        url: data.url,
        duration: recordedDuration,
      });
      
      Vibration.vibrate(50);
      clearRecording();
      setAudioPreviewVisible(false);
    } catch (error) {
      console.error('[ChatScreen] Audio upload error:', error);
      Alert.alert('Hata', 'Ses dosyası yüklenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDiscardAudio = () => {
    clearRecording();
    setAudioPreviewVisible(false);
  };

  // Elmas gönder
  const handleSendGift = (amount: number) => {
    if (!tokenGiftEnabled) {
      Alert.alert('Bakım', tokenGiftDisabledMessage || 'Elmas gönderimi geçici olarak kapalı.');
      setGiftModalVisible(false);
      return;
    }

    if (isFeatureLocked('gift')) {
      Alert.alert('Kilitli', `Elmas göndermek için Seviye ${FEATURE_UNLOCKS.gift}'e ulaşmalısınız.`);
      return;
    }

    if (!user || (user.tokenBalance || 0) < amount) {
      Alert.alert(
        'Yetersiz Bakiye', 
        `${amount} elmas gerekiyor.\nBakiyeniz: ${user?.tokenBalance || 0}`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Elmas Satın Al', onPress: () => {} },
        ],
      );
      return;
    }

    Vibration.vibrate(50);
    const socket = getSocket();
    console.log('[ChatScreen] Sending gift:', { fromUserId: user?.id, toUserId: partnerId, sessionId, amount });
    socket.emit('gift:send', {
      fromUserId: user?.id,
      toUserId: partnerId,
      sessionId,
      amount,
    });
    
    setGiftModalVisible(false);
  };

  const handleQuickPurchase = (tokens: number) => {
    Alert.alert(
      'Elmas Satın Al',
      `${tokens} elmas satın almak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: () => {
            const socket = getSocket();
            socket.emit('tokens:mock_purchase', {
              userId: user?.id,
              amount: tokens,
            });
            Vibration.vibrate([0, 50, 100, 50]);
            Alert.alert('Başarılı', `${tokens} elmas hesabınıza eklendi!`);
            setGiftModalVisible(false);
          },
        },
      ]
    );
  };

  // Medyaya tıklama - BASİT SİSTEM: message.locked kullan
  const handleMediaPress = (message: ChatMessage) => {
    console.log('===== handleMediaPress START =====');
    console.log('message.id:', message.id);
    console.log('message.locked:', message.locked);
    console.log('message.isFirstFree:', message.isFirstFree);
    console.log('message.mediaPrice:', message.mediaPrice);
    
    const mediaType = message.mediaType === 'video' ? 'video' : 
                      message.mediaType === 'audio' ? 'audio' : 'photo';

    if (mediaType === 'audio') {
      handleAudioPress(message);
      return;
    }

    // Kendi medyam ise direkt aç
    if (message.senderId === user?.id) {
      console.log('This is MY media - opening for free');
      setSelectedMedia(message);
      setIsCurrentMediaFirstFree(true);
      setIsMediaAlreadyPaid(false);
      setPhotoModalVisible(true);
      return;
    }

    // Zaten görüntülendi ise (ephemeral) açma
    if (viewedMediaIds.has(message.id)) {
      console.log('Already viewed - blocking');
      Vibration.vibrate(50);
      Alert.alert('Görüntülendi', 'Bu medya daha önce görüntülendi ve artık erişilemez.');
      return;
    }
    
    // SERVER'DAN GELEN locked VE isFirstFree KULLAN
    // locked=false ise ücretsiz (ilk medya)
    // locked=true ise ücretli
    const isFirstFree = !message.locked && message.isFirstFree === true;
    
    console.log(`isFirstFree: ${isFirstFree} (locked=${message.locked})`);
    console.log('===== Opening PhotoViewModal =====');
    
    setSelectedMedia(message);
    setIsCurrentMediaFirstFree(isFirstFree);
    setIsMediaAlreadyPaid(false);
    setPhotoModalVisible(true);
  };

  // Medya görüntüleme - BASİT SİSTEM: Socket event gönder
  const handleViewWithTokens = async (messageId: string): Promise<boolean> => {
    console.log('[handleViewWithTokens] messageId:', messageId);
    
    // Server locked field'ına bakacak ve karar verecek
    // Client-side bakiye kontrolü yapmaya gerek yok - server yapacak

    return new Promise((resolve) => {
      const socket = getSocket();
      
      const handleViewed = (payload: { messageId: string; success: boolean; cost: number; free?: boolean; newBalance?: number }) => {
        console.log('[handleViewWithTokens] media:viewed received:', payload);
        if (payload.messageId === messageId) {
          socket.off('media:viewed', handleViewed);
          socket.off('error', handleError);
          
          if (payload.success) {
            setViewedMediaIds(prev => new Set(prev).add(messageId));
            
            // Mesajı güncelle (locked = false)
            setMessages(prev => prev.map(m => 
              m.id === messageId ? { ...m, locked: false } : m
            ));
            
            Vibration.vibrate(30);
            resolve(true);
          } else {
            resolve(false);
          }
        }
      };
      
      const handleError = (payload: { code: string; message: string; required?: number; balance?: number }) => {
        console.log('[handleViewWithTokens] error received:', payload);
        socket.off('media:viewed', handleViewed);
        socket.off('error', handleError);
        
        if (payload.code === 'INSUFFICIENT_BALANCE') {
          const mediaType = selectedMedia?.mediaType === 'video' ? 'videoyu' : 'fotoğrafı';
          Alert.alert(
            'Yetersiz Elmas',
            `Bu ${mediaType} görmek için ${payload.required} elmas gerekiyor.\nBakiyeniz: ${payload.balance || 0}`,
          );
        } else {
          Alert.alert('Hata', payload.message || 'Bir hata oluştu.');
        }
        resolve(false);
      };
      
      socket.on('media:viewed', handleViewed);
      socket.on('error', handleError);
      
      console.log('[handleViewWithTokens] Emitting media:view');
      socket.emit('media:view', {
        messageId,
        userId: user?.id,
      });
      
      // 10 saniye timeout
      setTimeout(() => {
        socket.off('media:viewed', handleViewed);
        socket.off('error', handleError);
        console.log('[handleViewWithTokens] Timeout');
        resolve(false);
      }, 10000);
    });
  };
  

  // Ses kaydına tıklama - BASİT SİSTEM: message.locked kullan
  const handleAudioPress = (message: ChatMessage) => {
    // Kendi sesim ise zaten açık
    if (message.senderId === user?.id) {
      return;
    }

    // Zaten dinlendi ise açma
    if (viewedMediaIds.has(message.id)) {
      return;
    }

    // SERVER'DAN GELEN locked KULLAN
    const isFirstFree = !message.locked && message.isFirstFree === true;
    const tokenCost = message.mediaPrice || ELMAS_COSTS.viewAudio;

    console.log(`[ChatScreen] Audio press - locked: ${message.locked}, isFirstFree: ${isFirstFree}`);

    // İlk ücretsiz ise
    if (isFirstFree) {
      Alert.alert(
        'Ücretsiz Ses Kaydı',
        'İlk ses kaydı ücretsiz!',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Ücretsiz Dinle',
            onPress: () => {
              const socket = getSocket();
              socket.emit('media:view', {
                messageId: message.id,
                userId: user?.id,
              });
              setViewedMediaIds(prev => new Set(prev).add(message.id));
              setMessages(prev => prev.map(m => 
                m.id === message.id ? { ...m, locked: false } : m
              ));
            },
          },
        ],
      );
      return;
    }
    
    // Ücretli dinleme
    Alert.alert(
      'Ses Kaydı',
      `Bu ses kaydını dinlemek için ${tokenCost} elmas harcanacak.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: `Dinle (${tokenCost} elmas)`,
          onPress: () => {
            const socket = getSocket();
            socket.emit('media:view', {
              messageId: message.id,
              userId: user?.id,
            });
            setViewedMediaIds(prev => new Set(prev).add(message.id));
            setMessages(prev => prev.map(m => 
              m.id === message.id ? { ...m, locked: false } : m
            ));
          },
        },
      ],
    );
  };

  const handleAudioListened = (messageId: string) => {
    console.log('[ChatScreen] Audio listened (ephemeral):', messageId);
    setListenedAudioIds(prev => new Set(prev).add(messageId));
  };

  const handleRequestElmas = () => {
    const socket = getSocket();
    socket.emit('token:request', {
      fromUserId: user?.id,
      toUserId: partnerId,
      sessionId,
    });
    Vibration.vibrate(50);
    Alert.alert('Gönderildi', 'Elmas isteğiniz gönderildi!');
    setPhotoModalVisible(false);
  };

  // Zaman formatı
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Boş sohbet durumu
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color={COLORS.accent} />
      </View>
      <Text style={styles.emptyTitle}>Sohbete Başla!</Text>
      <Text style={styles.emptySubtitle}>
        İlk mesajı göndererek {partnerNickname} ile tanışmaya başla
      </Text>
      <View style={styles.emptyTips}>
        <View style={styles.emptyTipRow}>
          <Ionicons name="sparkles" size={16} color={COLORS.accent} />
          <Text style={styles.emptyTipText}>Samimi ve kibar ol</Text>
        </View>
        <View style={styles.emptyTipRow}>
          <Ionicons name="help-circle" size={16} color={COLORS.accent} />
          <Text style={styles.emptyTipText}>Açık uçlu sorular sor</Text>
        </View>
        <View style={styles.emptyTipRow}>
          <Ionicons name="heart" size={16} color={COLORS.accent} />
          <Text style={styles.emptyTipText}>Ortak ilgi alanlarını keşfet</Text>
        </View>
      </View>
    </View>
  );

  // Toolbar butonu
  const renderToolbarButton = (
    feature: keyof typeof FEATURE_UNLOCKS,
    icon: string,
    label: string,
    onPress: () => void,
    isActive?: boolean,
    customStyle?: object
  ) => {
    const locked = isFeatureLocked(feature);
    
    return (
      <TouchableOpacity
        style={[
          styles.toolbarButton,
          locked && styles.toolbarButtonLocked,
          isActive && styles.toolbarButtonActive,
          customStyle,
        ]}
        onPress={onPress}
        disabled={locked && feature !== 'gift'}
      >
        <View style={[styles.toolbarIconContainer, locked && styles.toolbarIconLocked]}>
          {locked ? (
            <View style={styles.lockedIconWrapper}>
              <Ionicons name={icon as any} size={22} color={COLORS.textMuted} />
              <View style={styles.lockBadge}>
                <Text style={styles.lockBadgeText}>{FEATURE_UNLOCKS[feature]}</Text>
              </View>
            </View>
          ) : (
            <Ionicons 
              name={icon as any} 
              size={22} 
              color={isActive ? COLORS.accent : COLORS.text} 
            />
          )}
        </View>
        <Text style={[
          styles.toolbarLabel,
          locked && styles.toolbarLabelLocked,
          isActive && styles.toolbarLabelActive,
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Modern Header - Sadece CardMatch */}
        <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
          <TouchableOpacity onPress={handleLeaveChat} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerBrand}>CardMatch</Text>
            {isPartnerTyping && (
              <Animated.View style={{ opacity: typingAnimation }}>
                <Text style={styles.typingText}>{partnerNickname} yazıyor...</Text>
              </Animated.View>
            )}
          </View>
          
          {/* Stage Indicator */}
          <View style={styles.stageContainer}>
            <View style={styles.stageIconRow}>
              {[1, 2, 3, 4, 5].map((s) => {
                const config = STAGE_CONFIG[s as keyof typeof STAGE_CONFIG];
                const isActive = s <= stage;
                return (
                  <View 
                    key={s} 
                    style={[
                      styles.stageIcon,
                      isActive && { backgroundColor: config.color },
                    ]}
                  >
                    <Ionicons 
                      name={config.icon as any} 
                      size={10} 
                      color={isActive ? COLORS.text : COLORS.textMuted} 
                    />
                  </View>
                );
              })}
            </View>
            <Text style={styles.stageText}>
              {stage < 5 ? formatTime(timeRemaining) : '∞'}
            </Text>
          </View>
          
          <TouchableOpacity onPress={() => setMenuModalVisible(true)} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Upload Loading Overlay */}
        {isUploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.uploadingText}>Yükleniyor...</Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          style={styles.list}
          contentContainerStyle={messages.length === 0 ? styles.emptyListContent : styles.listContent}
          data={messages}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={renderEmptyChat}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const isMediaUnlocked = isMine || viewedMediaIds.has(item.id) || item.locked === false;
            
            // SERVER'DAN GELEN isFirstFree KULLAN
            const isFirstFreeView = !isMine && item.isFirstFree === true && !item.locked;
            
            return (
              <MessageBubble
                message={item}
                isMine={isMine}
                onMediaPress={handleMediaPress}
                isFirstFreeView={isFirstFreeView}
                photoIndex={index}
                isUnlocked={isMediaUnlocked}
                onAudioListened={handleAudioListened}
                isAudioListened={listenedAudioIds.has(item.id)}
              />
            );
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Modern Toolbar */}
        <View style={styles.toolbar}>
          {renderToolbarButton('gift', 'diamond', 'Elmas', () => setGiftModalVisible(true))}
          
          {isRecording ? (
            <View style={styles.recordingControls}>
              <TouchableOpacity style={styles.recordingCancelButton} onPress={handleCancelRecording}>
                <Ionicons name="close" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>{recordingDuration}s</Text>
              </View>
              <TouchableOpacity style={styles.recordingStopButton} onPress={handleAudioTap}>
                <Ionicons name="stop" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          ) : (
            renderToolbarButton('audio', 'mic', 'Ses', handleAudioTap)
          )}

          {renderToolbarButton('photo', 'camera', 'Foto', handleSendPhoto)}
          {renderToolbarButton('video', 'videocam', 'Video', handleSendVideo)}
          {renderToolbarButton(
            'friend', 
            friendRequestSent ? 'checkmark-circle' : 'person-add', 
            friendRequestSent ? 'Eklendi' : 'Ekle', 
            handleAddFriend,
            friendRequestSent
          )}
        </View>

        {/* Modern Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Mesajınızı yazın..."
              placeholderTextColor={COLORS.textMuted}
              value={input}
              onChangeText={handleInputChange}
              editable={!isEnded}
              multiline
              maxLength={1000}
            />
          </View>
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.sendButton, (!input.trim() || isEnded) && styles.sendButtonDisabled]} 
              onPress={sendMessage}
              disabled={!input.trim() || isEnded}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={input.trim() && !isEnded ? COLORS.text : COLORS.textMuted} 
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Elmas Gönder Modal */}
        <Modal
          visible={giftModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setGiftModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.giftModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Elmas Gönder</Text>
                <TouchableOpacity onPress={() => setGiftModalVisible(false)} style={styles.modalCloseIcon}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.balanceRow}>
                <Ionicons name="diamond" size={20} color={COLORS.accent} />
                <Text style={styles.balanceText}>Bakiyeniz: {user?.tokenBalance || 0}</Text>
              </View>
              
              <Text style={styles.recipientText}>
                {partnerNickname} kişisine gönder
              </Text>
              
              <View style={styles.giftOptions}>
                {GIFT_OPTIONS.map((option) => {
                  const disabled = (user?.tokenBalance || 0) < option.amount;
                  return (
                    <TouchableOpacity
                      key={option.amount}
                      style={[styles.giftOption, disabled && styles.giftOptionDisabled]}
                      onPress={() => handleSendGift(option.amount)}
                      disabled={disabled}
                    >
                      <LinearGradient
                        colors={disabled ? [COLORS.surface, COLORS.surface] : [COLORS.primary, COLORS.primaryDark]}
                        style={styles.giftOptionGradient}
                      >
                        <Ionicons name="diamond" size={24} color={disabled ? COLORS.textMuted : COLORS.accent} />
                        <Text style={[styles.giftOptionAmount, disabled && styles.giftOptionAmountDisabled]}>
                          {option.label}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.purchaseSection}>
                <Text style={styles.purchaseSectionTitle}>Elmas Satın Al</Text>
                <View style={styles.purchaseOptions}>
                  {PURCHASE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.tokens}
                      style={[styles.purchaseOption, option.popular && styles.purchaseOptionPopular]}
                      onPress={() => handleQuickPurchase(option.tokens)}
                    >
                      {option.popular && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>Popüler</Text>
                        </View>
                      )}
                      <Ionicons name="diamond" size={16} color={COLORS.accent} />
                      <Text style={styles.purchaseTokens}>{option.tokens}</Text>
                      <Text style={styles.purchasePrice}>{option.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Menü Modal - Bildir, Engelle, Beğen */}
        <Modal
          visible={menuModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.menuModalOverlay}
            activeOpacity={1}
            onPress={() => setMenuModalVisible(false)}
          >
            <View style={styles.menuModalContent}>
              <Text style={styles.menuModalTitle}>Seçenekler</Text>
              
              <TouchableOpacity style={styles.menuOption} onPress={handleLikeUser}>
                <Ionicons name="heart" size={20} color={COLORS.success} />
                <Text style={[styles.menuOptionText, { color: COLORS.success }]}>Beğen (İyi Kullanıcı)</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuOption}
                onPress={() => {
                  setMenuModalVisible(false);
                  setReportModalVisible(true);
                }}
              >
                <Ionicons name="flag" size={20} color={COLORS.warning} />
                <Text style={[styles.menuOptionText, { color: COLORS.warning }]}>Bildir</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.menuOption, styles.menuOptionDanger]}
                onPress={handleBlockUser}
              >
                <Ionicons name="ban" size={20} color={COLORS.error} />
                <Text style={[styles.menuOptionText, styles.menuOptionDangerText]}>Engelle</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.menuOptionCancel}
                onPress={() => setMenuModalVisible(false)}
              >
                <Text style={styles.menuOptionCancelText}>İptal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Report Modal */}
        <Modal
          visible={reportModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.reportModalOverlay}>
            <View style={styles.reportModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.reportModalTitle}>Kullanıcıyı Bildir</Text>
                <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.reportModalSubtitle}>
                {partnerNickname} kullanıcısını neden bildirmek istiyorsunuz?
              </Text>
              
              {['SPAM', 'HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'OTHER'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.reportCategoryButton,
                    reportCategory === cat && styles.reportCategoryButtonActive,
                  ]}
                  onPress={() => setReportCategory(cat)}
                >
                  <Ionicons 
                    name={
                      cat === 'SPAM' ? 'mail' :
                      cat === 'HARASSMENT' ? 'warning' :
                      cat === 'FAKE_PROFILE' ? 'person-circle' :
                      cat === 'INAPPROPRIATE_CONTENT' ? 'eye-off' : 'help-circle'
                    } 
                    size={18} 
                    color={reportCategory === cat ? COLORS.accent : COLORS.textMuted} 
                  />
                  <Text style={[
                    styles.reportCategoryText,
                    reportCategory === cat && styles.reportCategoryTextActive,
                  ]}>
                    {cat === 'SPAM' && 'Spam'}
                    {cat === 'HARASSMENT' && 'Taciz'}
                    {cat === 'FAKE_PROFILE' && 'Sahte Profil'}
                    {cat === 'INAPPROPRIATE_CONTENT' && 'Uygunsuz İçerik'}
                    {cat === 'OTHER' && 'Diğer'}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TextInput
                style={styles.reportDescriptionInput}
                placeholder="Ek açıklama (isteğe bağlı)"
                placeholderTextColor={COLORS.textMuted}
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
                maxLength={500}
              />
              
              <View style={styles.reportActions}>
                <TouchableOpacity
                  style={styles.reportCancelButton}
                  onPress={() => {
                    setReportModalVisible(false);
                    setReportCategory('');
                    setReportDescription('');
                  }}
                >
                  <Text style={styles.reportCancelText}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reportSubmitButton,
                    !reportCategory && styles.reportSubmitButtonDisabled,
                  ]}
                  onPress={handleReportUser}
                  disabled={!reportCategory}
                >
                  <Text style={styles.reportSubmitText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Değerlendirme Modal - Sohbet Bittiğinde */}
        <Modal
          visible={ratingModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => handleRating('skip')}
        >
          <View style={styles.ratingModalOverlay}>
            <View style={styles.ratingModalContent}>
              <View style={styles.ratingIconContainer}>
                <Ionicons name="chatbubbles" size={48} color={COLORS.accent} />
              </View>
              
              <Text style={styles.ratingTitle}>Sohbet Sona Erdi</Text>
              <Text style={styles.ratingSubtitle}>
                {partnerNickname} ile sohbetiniz nasıldı?
              </Text>
              
              <View style={styles.ratingActions}>
                <TouchableOpacity 
                  style={styles.ratingLikeButton}
                  onPress={() => handleRating('like')}
                >
                  <LinearGradient
                    colors={[COLORS.success, '#27ae60']}
                    style={styles.ratingButtonGradient}
                  >
                    <Ionicons name="heart" size={24} color={COLORS.text} />
                    <Text style={styles.ratingButtonText}>Beğendim</Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.ratingSkipButton}
                  onPress={() => handleRating('skip')}
                >
                  <Text style={styles.ratingSkipText}>Geç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Photo View Modal */}
        {selectedMedia && (
          <PhotoViewModal
            visible={photoModalVisible}
            onClose={() => {
              setPhotoModalVisible(false);
              setSelectedMedia(null);
              setIsCurrentMediaFirstFree(false);
              setIsMediaAlreadyPaid(false);
            }}
            onViewed={(msgId, mType) => {
              console.log(`[ChatScreen] Media viewed: ${msgId}, type: ${mType}`);
              setViewedMediaIds(prev => new Set(prev).add(msgId));
              // Mesajı güncelle (locked = false)
              setMessages(prev => prev.map(m => 
                m.id === msgId ? { ...m, locked: false } : m
              ));
            }}
            imageUrl={selectedMedia.mediaUrl || ''}
            messageId={selectedMedia.id}
            mediaType={selectedMedia.mediaType === 'video' ? 'video' : 'photo'}
            isMine={selectedMedia.senderId === user?.id}
            isFirstFreeView={isCurrentMediaFirstFree}
            elmasCost={selectedMedia.mediaType === 'video' ? ELMAS_COSTS.viewVideo : ELMAS_COSTS.viewPhoto}
            userElmasBalance={user?.tokenBalance || 0}
            onViewWithElmas={handleViewWithTokens}
            onRequestElmas={handleRequestElmas}
            onPurchaseElmas={() => {
              setPhotoModalVisible(false);
              setSelectedMedia(null);
              setGiftModalVisible(true);
            }}
            senderNickname={partnerNickname}
            isInstantPhoto={selectedMedia.isInstant || false}
          />
        )}

        {/* Video Önizleme */}
        {pendingVideoUri && (
          <VideoPreview
            visible={videoPreviewVisible}
            videoUri={pendingVideoUri}
            onClose={handleVideoPreviewClose}
            onSend={handleVideoSend}
          />
        )}

        {/* Fotoğraf Düzenleme */}
        {pendingPhotoUri && (
          <PhotoEditor
            visible={photoEditorVisible}
            imageUri={pendingPhotoUri}
            onClose={handlePhotoEditorClose}
            onSave={handlePhotoEditorSave}
          />
        )}

        {/* Ses Önizleme Modal */}
        <Modal
          visible={audioPreviewVisible}
          transparent
          animationType="fade"
          onRequestClose={handleDiscardAudio}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.audioPreviewModal}>
              <View style={styles.audioPreviewHeader}>
                <Ionicons name="mic" size={32} color={COLORS.accent} />
                <Text style={styles.audioPreviewTitle}>Ses Kaydı</Text>
              </View>
              <Text style={styles.audioPreviewDuration}>{recordedDuration} saniye</Text>
              
              <TouchableOpacity 
                style={styles.audioPreviewPlayButton}
                onPress={isPlayingPreview ? stopPreview : playPreview}
              >
                <Ionicons 
                  name={isPlayingPreview ? 'pause' : 'play'} 
                  size={24} 
                  color={COLORS.text} 
                />
                <Text style={styles.audioPreviewPlayText}>
                  {isPlayingPreview ? 'Durdur' : 'Dinle'}
                </Text>
              </TouchableOpacity>

              <View style={styles.audioPreviewActions}>
                <TouchableOpacity 
                  style={styles.audioPreviewDiscardButton}
                  onPress={handleDiscardAudio}
                >
                  <Ionicons name="trash" size={20} color={COLORS.text} />
                  <Text style={styles.audioPreviewDiscardText}>Sil</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.audioPreviewSendButton}
                  onPress={handleConfirmSendAudio}
                >
                  <Ionicons name="send" size={20} color={COLORS.text} />
                  <Text style={styles.audioPreviewSendText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.accent,
  },
  typingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  stageContainer: {
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  stageIconRow: {
    flexDirection: 'row',
    gap: 3,
  },
  stageIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageText: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Upload Overlay
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  uploadingText: {
    color: COLORS.text,
    marginTop: SPACING.sm,
    fontSize: 14,
  },
  // List Styles
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  // Empty State
  emptyContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTips: {
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  emptyTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyTipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  // Toolbar Styles
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  toolbarButton: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  toolbarButtonLocked: {
    opacity: 0.5,
  },
  toolbarButtonActive: {},
  toolbarIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  toolbarIconLocked: {
    backgroundColor: COLORS.surface,
  },
  lockedIconWrapper: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  toolbarLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  toolbarLabelLocked: {
    color: COLORS.textDisabled,
  },
  toolbarLabelActive: {
    color: COLORS.accent,
  },
  // Recording Controls
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error,
    borderRadius: 20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  recordingCancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.text,
    marginRight: SPACING.xs,
  },
  recordingTime: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  recordingStopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Input Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === 'ios' ? SPACING.sm : 0,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.surface,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  giftModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalCloseIcon: {
    padding: SPACING.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  balanceText: {
    fontSize: 16,
    color: COLORS.text,
  },
  recipientText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  giftOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.xl,
  },
  giftOption: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  giftOptionDisabled: {
    opacity: 0.5,
  },
  giftOptionGradient: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  giftOptionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  giftOptionAmountDisabled: {
    color: COLORS.textMuted,
  },
  purchaseSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.lg,
  },
  purchaseSectionTitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  purchaseOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  purchaseOption: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    position: 'relative',
  },
  purchaseOptionPopular: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  purchaseTokens: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  purchasePrice: {
    fontSize: 12,
    color: COLORS.accent,
  },
  // Menu Modal
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
  },
  menuModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  menuOptionDanger: {
    borderBottomWidth: 0,
  },
  menuOptionDangerText: {
    color: COLORS.error,
  },
  menuOptionCancel: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuOptionCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  // Report Modal
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  reportModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    maxHeight: '80%',
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  reportModalSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  reportCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  reportCategoryButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(125, 212, 212, 0.1)',
  },
  reportCategoryText: {
    fontSize: 15,
    color: COLORS.text,
  },
  reportCategoryTextActive: {
    color: COLORS.accent,
    fontWeight: '500',
  },
  reportDescriptionInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    minHeight: 80,
    marginTop: SPACING.md,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  reportActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  reportCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportCancelText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  reportSubmitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.error,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  // Rating Modal
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  ratingModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    width: '100%',
    alignItems: 'center',
  },
  ratingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  ratingSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  ratingActions: {
    width: '100%',
    gap: SPACING.md,
  },
  ratingLikeButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ratingButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  ratingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  ratingSkipButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  ratingSkipText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  // Audio Preview Modal
  audioPreviewModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  audioPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  audioPreviewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  audioPreviewDuration: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  audioPreviewPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 30,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  audioPreviewPlayText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  audioPreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: SPACING.md,
  },
  audioPreviewDiscardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  audioPreviewDiscardText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  audioPreviewSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  audioPreviewSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default ChatScreen;
