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
  Image,
  Dimensions,
  Vibration,
  ActionSheetIOS,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useIAPContext } from '../../context/IAPContext';
import { DIAMOND_AMOUNT_TO_PRODUCT_ID } from '../../constants/iapProducts';
import MessageBubble from '../../components/MessageBubble';
import ProfilePhoto from '../../components/ProfilePhoto';
import PhotoEditor from '../../components/PhotoEditor';
import VideoPreview from '../../components/VideoPreview';
import PhotoViewModal from '../../components/PhotoViewModal';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Elmas maliyetleri (match sistemiyle aynı)
const ELMAS_COSTS = {
  viewAudio: 5,
  viewPhoto: 20,
  viewVideo: 50,
};

type Props = NativeStackScreenProps<any, 'FriendChat'>;

interface FriendMessage {
  id: string;
  senderId: string;
  content?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null; // 🎬 Video thumbnail URL
  mediaType?: 'audio' | 'photo' | 'video' | null;
  isInstant?: boolean;
  isViewed?: boolean;
  createdAt: string;
  isSystem?: boolean;
  systemType?: 'gift' | 'info';
  systemData?: {
    fromNickname?: string;
    amount?: number;
  };
  // YENİ: Medya kilitleme sistemi
  locked?: boolean;      // Medya kilitli mi?
  isFirstFree?: boolean; // Bu gönderenin ilk medyası mı?
  mediaPrice?: number;   // Açma maliyeti
}

// Hediye seçenekleri
const GIFT_OPTIONS = [
  { amount: 10, emoji: '💎', label: '10', popular: false },
  { amount: 50, emoji: '💎💎', label: '50', popular: true },
  { amount: 100, emoji: '💎💎💎', label: '100', popular: false },
];

// Hızlı satın alma seçenekleri (Apple IAP fiyatları)
const PURCHASE_OPTIONS = [
  { tokens: 50, price: '49,99 TL', popular: false },
  { tokens: 100, price: '79,99 TL', popular: true },
  { tokens: 250, price: '149,99 TL', popular: false },
];

// Avatar listesi
// Avatar listesi - merkezi dosyadan import
import { AVATARS, getAvatar } from '../../constants/avatars';

const FriendChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { friendshipId, friendNickname, friendPhoto, friendAvatarId, friendOnline, friendId } =
    route.params || {};
  
  // Avatar helper - merkezi dosyadan import ediliyor
  const avatar = getAvatar(friendAvatarId);
  const { user, deductTokens, updateTokenBalance, addTokens, refreshProfile, instantBalance } = useAuth();
  const { isReady: iapReady, purchaseItem, finishTransaction } = useIAPContext();
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
  const [selectedMedia, setSelectedMedia] = useState<FriendMessage | null>(null);
  
  // Medya kilitleme sistemi - BASİT: message.locked kullan
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [viewedMediaIds, setViewedMediaIds] = useState<Set<string>>(new Set());
  const [isCurrentMediaFirstFree, setIsCurrentMediaFirstFree] = useState(false);
  const [isMediaAlreadyPaid, setIsMediaAlreadyPaid] = useState(false);
  const [isPartnerInChat, setIsPartnerInChat] = useState(false); // Arkadaş sohbette mi?
  
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
  
  // Ses kaydı unlock modal
  const [audioUnlockModalVisible, setAudioUnlockModalVisible] = useState(false);
  const [pendingAudioMessage, setPendingAudioMessage] = useState<any>(null);
  const [pendingAudioCost, setPendingAudioCost] = useState(5);
  
  // Medya seçici (iOS: ActionSheet, Android: Modal)
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaPickerType, setMediaPickerType] = useState<'photo' | 'video'>('photo');
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

  // Socket handler'ları useCallback ile (memory leak önleme - aynı referans ile socket.off)
  const handlePresence = useCallback((payload: { friendshipId: string; userId: string; isOnline: boolean }) => {
    if (payload.friendshipId === friendshipId && payload.userId === friendId) {
      setIsPartnerInChat(payload.isOnline);
      console.log(`[FriendChat] Partner presence: ${payload.isOnline ? 'online' : 'offline'}`);
    }
  }, [friendshipId, friendId]);

  const handleFriendMessage = useCallback((msg: FriendMessage & { friendChatId?: string }) => {
    if (msg.friendChatId !== friendshipId) return;
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [friendshipId]);

  const handleGiftUpdate = useCallback((payload: {
    fromUserId: string; toUserId: string; amount: number; fromNickname: string;
    senderNewBalance: number; receiverNewBalance: number; timestamp: number;
  }) => {
    const isSender = payload.fromUserId === user?.id;
    const isReceiver = payload.toUserId === user?.id;
    if (isSender) {
      updateTokenBalance(payload.senderNewBalance);
      setMessages((prev) => [...prev, {
        id: `gift-sent-${payload.timestamp}`,
        senderId: 'system',
        isSystem: true,
        systemType: 'gift',
        content: `💎 -${payload.amount} elmas gönderildi!`,
        createdAt: new Date().toISOString(),
      }]);
      showGiftAnimation(payload.amount, 'sent');
    } else if (isReceiver) {
      updateTokenBalance(payload.receiverNewBalance);
      setMessages((prev) => [...prev, {
        id: `gift-received-${payload.timestamp}`,
        senderId: 'system',
        isSystem: true,
        systemType: 'gift',
        systemData: { fromNickname: payload.fromNickname, amount: payload.amount },
        content: `🎁 +${payload.amount} elmas alındı!`,
        createdAt: new Date().toISOString(),
      }]);
      showGiftAnimation(payload.amount, 'received');
    }
  }, [user?.id, updateTokenBalance, showGiftAnimation]);

  const handleGiftError = useCallback((payload: { code: string; message: string; disabled?: boolean }) => {
    if (payload.code === 'FEATURE_DISABLED' || payload.disabled) {
      setTokenGiftEnabled(false);
      setTokenGiftDisabledMessage(payload.message);
      Alert.alert('Bakım', payload.message);
    } else {
      Alert.alert('Hata', payload.message);
    }
  }, []);

  const handleMediaDeleted = useCallback((payload: { messageId: string; friendshipId: string; deletedBy: string }) => {
    setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
  }, []);

  // Socket bağlantısı ve mesaj dinleyicileri
  useEffect(() => {
    const socket = getSocket();
    console.log('[FriendChat] 🔌 Setting up socket listeners for room:', friendshipId);
    socket.emit('friend:join', { friendshipId, userId: user?.id });

    socket.once('friend:joined', (data: { friendshipId: string; success: boolean }) => {
      console.log('[FriendChat] ✅ Joined room:', data);
    });

    loadMessages();

    socket.on('friend:presence', handlePresence);
    socket.on('friend:message', handleFriendMessage);
    socket.on('friend:gift:update', handleGiftUpdate);
    socket.on('friend:gift:error', handleGiftError);
    socket.on('friend:media:deleted', handleMediaDeleted);

    return () => {
      console.log('[FriendChat] 🧹 Cleanup - removing listeners and leaving room');
      socket.emit('friend:leave', { friendshipId, userId: user?.id });
      socket.off('friend:presence', handlePresence);
      socket.off('friend:message', handleFriendMessage);
      socket.off('friend:gift:update', handleGiftUpdate);
      socket.off('friend:gift:error', handleGiftError);
      socket.off('friend:media:deleted', handleMediaDeleted);
    };
  }, [friendshipId, friendId, user?.id, handlePresence, handleFriendMessage, handleGiftUpdate, handleGiftError, handleMediaDeleted]);

  // Mevcut mesajları API'den yükle
  const loadMessages = async () => {
    try {
      const res = await api.get(`/api/user/friends/${friendshipId}/messages`);
      if (res.data.success) {
        const msgs = res.data.data || [];
        console.log('[FriendChat] 📥 Loaded messages from API:', msgs.length, 'messages');
        // Medya mesajlarını logla
        const mediaMessages = msgs.filter((m: FriendMessage) => m.mediaUrl);
        console.log('[FriendChat] 📸 Media messages:', mediaMessages.map((m: FriendMessage) => ({ id: m.id, mediaUrl: m.mediaUrl, mediaType: m.mediaType })));
        setMessages(msgs);
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

      const apiBaseUrl = api.defaults.baseURL || '';
      const response = await fetch(`${apiBaseUrl}/api/upload/audio`, {
        method: 'POST',
        body: formData,
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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', '📷 Anlık Çek', '🖼️ Galeriden'],
          cancelButtonIndex: 0,
          title: 'Fotoğraf Gönder',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickPhotoFromCamera(true);
          } else if (buttonIndex === 2) {
            pickPhotoFromGallery(false);
          }
        }
      );
    } else {
      setMediaPickerType('photo');
      setMediaPickerVisible(true);
    }
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
    // Galeri izni iste
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
      return;
    }

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
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', '🎥 Anlık Çek', '📁 Galeriden'],
          cancelButtonIndex: 0,
          title: 'Video Gönder',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickVideoFromCamera(true);
          } else if (buttonIndex === 2) {
            pickVideoFromGallery(false);
          }
        }
      );
    } else {
      setMediaPickerType('video');
      setMediaPickerVisible(true);
    }
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
      allowsEditing: false,
      videoMaxDuration: 60,
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
    // Galeri izni iste
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false, // iOS kırpma özelliği düzgün çalışmıyor
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      // Video süresi VideoPreview'da kontrol edilecek
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

      const apiBaseUrl = api.defaults.baseURL || '';
      const endpoint = type === 'photo' ? '/api/upload/photo' : '/api/upload/video';
      
      console.log(`[FriendChat] Uploading ${type} to ${apiBaseUrl}${endpoint}`);
      
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        body: formData,
        // Content-Type header'ı FormData için otomatik ayarlanır - manuel ayarlamayın!
      });

      console.log(`[FriendChat] Upload response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FriendChat] Upload error: ${errorText}`);
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      console.log(`[FriendChat] Upload successful, URL: ${data.url}`);
      if (data.thumbnailUrl) {
        console.log(`[FriendChat] 🎬 Thumbnail URL: ${data.thumbnailUrl}`);
      }

      const socket = getSocket();
      socket.emit('friend:media', {
        friendshipId,
        senderId: user?.id,
        mediaType: type,
        mediaUrl: data.url,
        thumbnailUrl: data.thumbnailUrl, // 🎬 Thumbnail URL (video için)
        duration: data.duration, // Video duration (saniye)
        isInstant,
      });
      
      Vibration.vibrate(30);
    } catch (error) {
      console.error(`[FriendChat] ${type} upload error:`, error);
      Alert.alert('Hata', `${type === 'photo' ? 'Fotoğraf' : 'Video'} yüklenemedi.`);
    }
  };

  // ============ HEDİYE ELMAS ============
  const handleSendGift = (amount: number, skipBalanceCheck = false) => {
    if (!user) return;
    
    // 🔴 KILL SWITCH: Feature devre dışıysa uyar
    if (!tokenGiftEnabled) {
      Alert.alert('Bakım', tokenGiftDisabledMessage || 'Elmas gönderimi geçici olarak kapalı.');
      setGiftModalVisible(false);
      return;
    }
    
    if (!skipBalanceCheck && instantBalance < amount) {
      // Yetersiz bakiye - satın alma ekranını göster
      setPendingGiftAmount(amount);
      setGiftModalVisible(false);
      setPurchaseModalVisible(true);
      return;
    }

    // Server'a gönder - UI güncellemesi friend:gift:update event'inde yapılacak
    console.log('[FriendChat] 💸 Sending gift:', amount);
    
    const socket = getSocket();
    socket.emit('friend:gift', {
      fromUserId: user.id,
      toUserId: friendId,
      friendshipId,
      amount,
    });
    
    // Modal'ı kapat - animasyon friend:gift:update event'inde gösterilecek
    setGiftModalVisible(false);
  };

  // Hızlı satın alma: önce gerçek IAP, sonra backend + hediye seçeneği
  const handlePurchaseComplete = async (purchasedAmount: number) => {
    const productId = DIAMOND_AMOUNT_TO_PRODUCT_ID[purchasedAmount];
    if (!productId) return;
    if (!iapReady) {
      Alert.alert('Bilgi', 'Mağaza hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
      return;
    }
    const giftAmount = pendingGiftAmount;
    setPurchaseModalVisible(false);
    setPendingGiftAmount(0);

    try {
      const purchase = await purchaseItem(productId);
      const transactionId = (purchase as any).transactionId ?? (purchase as any).purchaseToken ?? '';
      const res = await api.post<{ success: boolean; data: { newBalance: number } }>(
        '/api/user/purchase-tokens',
        { amount: purchasedAmount, transactionId }
      );
      if (res.data.success) {
        await finishTransaction(purchase, true);
        if (res.data.data?.newBalance !== undefined) {
          updateTokenBalance(res.data.data.newBalance);
        }
        const buttons: Array<{ text: string; onPress?: () => void }> = [];
        if (giftAmount > 0) {
          buttons.push({
            text: 'Hediye Gönder',
            onPress: () => setTimeout(() => handleSendGift(giftAmount, true), 300),
          });
        }
        buttons.push({ text: 'Tamam' });
        Alert.alert('Başarılı! 💎', `${purchasedAmount} elmas hesabınıza eklendi!`, buttons);
      } else {
        Alert.alert('Hata', 'Satın alma sunucuda işlenemedi. Destek ile iletişime geçin.');
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('cancel') || error?.message?.toLowerCase().includes('iptal')) return;
      console.error('Purchase error:', error);
      Alert.alert('Hata', error?.message ?? 'Satın alma sırasında bir hata oluştu.');
    }
  };

  // ============ MEDYA KİLİTLEME SİSTEMİ ============
  
  // Medya tıklandığında - BASİT SİSTEM: message.locked kullan
  const handleMediaPress = (message: FriendMessage) => {
    if (!message.mediaUrl) return;
    
    const isMine = message.senderId === user?.id;
    
    // AUDIO için ayrı işlem
    if (message.mediaType === 'audio') {
      console.log(`[FriendChat] Audio press: locked=${message.locked}, isFirstFree=${message.isFirstFree}`);
      
      // Kendi sesim ise direkt aç
      if (isMine) {
        // Audio component kendisi handle ediyor
        return;
      }
      
      // Zaten dinlendi mi?
      if (viewedMediaIds.has(message.id)) {
        return; // AudioMessage component allows multiple listens if already unlocked
      }
      
      // İlk ücretsiz ses
      const isFirstFree = !message.locked && message.isFirstFree === true;
      if (isFirstFree) {
        // Ücretsiz aç
        handleViewWithElmas(message.id).then(success => {
          if (success) {
            setViewedMediaIds(prev => new Set(prev).add(message.id));
          }
        });
        return;
      }
      
      // Kilitli ses - elmas ile aç (temalı modal)
      if (message.locked) {
        const audioCost = message.mediaPrice || 5;
        setPendingAudioMessage(message);
        setPendingAudioCost(audioCost);
        setAudioUnlockModalVisible(true);
      }
      return;
    }
    
    // PHOTO/VIDEO için
    if (message.mediaType !== 'photo' && message.mediaType !== 'video') return;
    
    // Kendi medyam ise direkt aç
    if (isMine) {
      setSelectedMedia(message);
      setIsCurrentMediaFirstFree(true);
      setIsMediaAlreadyPaid(false);
      setPhotoModalVisible(true);
      return;
    }
    
    // Zaten görüntülendi mi? (ephemeral - sadece 1 kez izlenebilir)
    if (viewedMediaIds.has(message.id)) {
      Vibration.vibrate(50);
      Alert.alert('Görüntülendi', 'Bu medya daha önce görüntülendi ve artık erişilemez.');
      return;
    }
    
    // SERVER'DAN GELEN locked VE isFirstFree KULLAN
    const isFirstFree = !message.locked && message.isFirstFree === true;
    
    console.log(`[FriendChat] Media press: locked=${message.locked}, isFirstFree=${isFirstFree}`);
    
    setSelectedMedia(message);
    setIsCurrentMediaFirstFree(isFirstFree);
    setIsMediaAlreadyPaid(false);
    setPhotoModalVisible(true);
  };

  // Elmas ile medya görüntüleme - Match sistemiyle aynı mantık
  const handleViewWithElmas = async (messageId: string): Promise<boolean> => {
    console.log('[FriendChat] handleViewWithElmas messageId:', messageId);

    return new Promise((resolve) => {
      const socket = getSocket();
      
      const handleViewed = (payload: { 
        messageId: string; 
        success: boolean; 
        cost?: number; 
        free?: boolean; 
        newBalance?: number;
        error?: string;
        required?: number;
        balance?: number;
      }) => {
        console.log('[FriendChat] friend:media:viewed received:', payload);
        if (payload.messageId === messageId) {
          socket.off('friend:media:viewed', handleViewed);
          
          if (payload.success) {
            // Bakiyeyi güncelle
            if (payload.newBalance !== undefined) {
              updateTokenBalance(payload.newBalance);
            }
            
            setViewedMediaIds(prev => new Set(prev).add(messageId));
            
            // Mesajı güncelle (locked = false)
            setMessages(prev => prev.map(m => 
              m.id === messageId ? { ...m, locked: false, isViewed: true } : m
            ));
            
            Vibration.vibrate(30);
            resolve(true);
          } else {
            // Hata durumu
            if (payload.error === 'INSUFFICIENT_BALANCE') {
              const mediaType = selectedMedia?.mediaType === 'video' ? 'videoyu' : 'fotoğrafı';
              Alert.alert(
                'Yetersiz Elmas',
                `Bu ${mediaType} görmek için ${payload.required} elmas gerekiyor.\nBakiyeniz: ${payload.balance || 0}`,
              );
            } else {
              Alert.alert('Hata', 'Görüntüleme sırasında bir hata oluştu.');
            }
            resolve(false);
          }
        }
      };
      
      socket.on('friend:media:viewed', handleViewed);
      
      console.log('[FriendChat] Emitting friend:media:view');
      socket.emit('friend:media:view', {
        friendshipId,
        messageId,
        viewerId: user?.id,
      });
      
      // 10 saniye timeout
      setTimeout(() => {
        socket.off('friend:media:viewed', handleViewed);
        console.log('[FriendChat] Timeout - no response from server');
        resolve(false);
      }, 10000);
    });
  };

  // Elmas iste
  const handleRequestElmas = () => {
    setPhotoModalVisible(false);
    setSelectedMedia(null);
    Alert.alert('Elmas İste', 'Arkadaşınızdan elmas isteyebilirsiniz!');
  };

  // Medya görüntülendi - Snapchat tarzı silme
  const handleMediaViewed = (messageId: string, mediaType: 'photo' | 'video') => {
    console.log(`[FriendChat] Media viewed and will be deleted: ${messageId}, type: ${mediaType}`);
    
    // Sunucuya silme isteği gönder
    const socket = getSocket();
    if (socket) {
      socket.emit('friend:media:delete', {
        messageId,
        friendshipId,
      });
    }
    
    // Görüntülendikten sonra mesajı listeden sil
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, 500); // Kısa gecikme ile animasyonlu kapanma
  };
  
  // Ses dinlendi - Snapchat tarzı silme (fotoğraf/video ile aynı)
  const handleAudioListened = (messageId: string) => {
    console.log(`[FriendChat] Audio listened and will be deleted: ${messageId}`);
    
    // Görüntülendi olarak işaretle
    setViewedMediaIds(prev => new Set(prev).add(messageId));
    
    // Sunucuya silme isteği gönder
    const socket = getSocket();
    if (socket) {
      socket.emit('friend:media:delete', {
        messageId,
        friendshipId,
        deletedBy: user?.id,
      });
    }
    
    // Mesajı listeden sil
    setTimeout(() => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
    }, 1000); // Ses bitişinden 1sn sonra sil
  };

  // Elmas satın al modalını aç
  const handlePurchaseElmas = () => {
    setPhotoModalVisible(false);
    setSelectedMedia(null);
    setPurchaseModalVisible(true);
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
            {friendPhoto ? (
              <ProfilePhoto
                uri={friendPhoto}
                size={40}
                online={friendOnline}
              />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: avatar.color }]}>
                <Text style={styles.headerAvatarEmoji}>{avatar.emoji}</Text>
                {friendOnline && <View style={styles.headerOnlineIndicator} />}
              </View>
            )}
            <View style={styles.headerTextContainer}>
              <Text style={FONTS.h3}>{friendNickname}</Text>
              <Text style={FONTS.caption}>
                {friendOnline ? 'Çevrimiçi' : 'Çevrimdışı'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          style={styles.list}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const isMine = item.senderId === user?.id;
            const isViewed = viewedMediaIds.has(item.id) || item.isViewed;
            const isUnlocked = isMine || isViewed || item.locked === false;
            
            // SERVER'DAN GELEN isFirstFree KULLAN
            const isFirstFreeView = !isMine && item.isFirstFree === true && !item.locked;
            
            return (
              <MessageBubble
                message={{ ...item, isViewed }}
                isMine={isMine}
                isUnlocked={isUnlocked}
                isFirstFreeView={isFirstFreeView}
                photoIndex={index}
                onMediaPress={handleMediaPress}
                onAudioListened={handleAudioListened}
                isAudioListened={viewedMediaIds.has(item.id)}
              />
            );
          }}
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

        {/* Gift Modal - Temalı Tasarım */}
        <Modal
          visible={giftModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGiftModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.giftModalOverlay}
            activeOpacity={1}
            onPress={() => setGiftModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.giftModalContent}>
              <View style={styles.giftModalHandle} />
              
              {/* Header */}
              <View style={styles.giftModalHeader}>
                <View style={styles.giftModalIconWrapper}>
                  <LinearGradient
                    colors={[COLORS.accent, '#5fb8b8']}
                    style={styles.giftModalIconGradient}
                  >
                    <Ionicons name="diamond" size={28} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.giftModalTitle}>Elmas Hediye Et</Text>
                <Text style={styles.giftModalSubtitle}>Arkadaşına sürpriz yap</Text>
              </View>

              {/* Balance Card */}
              <View style={styles.giftBalanceCard}>
                <Ionicons name="wallet-outline" size={18} color={COLORS.accent} />
                <Text style={styles.giftBalanceLabel}>Bakiyen</Text>
                <View style={styles.giftBalanceAmount}>
                  <Ionicons name="diamond" size={16} color={COLORS.accent} />
                  <Text style={styles.giftBalanceValue}>{instantBalance}</Text>
                </View>
              </View>

              {/* Gift Options */}
              <View style={styles.giftOptionsRow}>
                {GIFT_OPTIONS.map((option, index) => {
                  const canAfford = instantBalance >= option.amount;
                  return (
                    <TouchableOpacity
                      key={option.amount}
                      style={[
                        styles.giftOptionCard,
                        !canAfford && styles.giftOptionCardDisabled,
                      ]}
                      onPress={() => canAfford && handleSendGift(option.amount)}
                      disabled={!canAfford}
                    >
                      <LinearGradient
                        colors={canAfford ? [COLORS.primary, COLORS.primaryDark] : ['#333', '#222']}
                        style={styles.giftOptionCardGradient}
                      >
                        {option.popular && (
                          <View style={styles.giftPopularTag}>
                            <Text style={styles.giftPopularTagText}>Popüler</Text>
                          </View>
                        )}
                        <Text style={styles.giftOptionEmoji}>{option.emoji}</Text>
                        <Text style={[styles.giftOptionValue, !canAfford && styles.giftOptionValueDisabled]}>
                          {option.amount}
                        </Text>
                        <Text style={styles.giftOptionDesc}>elmas</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Purchase Section */}
              <View style={styles.giftPurchaseSection}>
                <Text style={styles.giftPurchaseTitle}>💰 Elmas Satın Al</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.giftPurchaseScroll}>
                  {PURCHASE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.tokens}
                      style={[styles.giftPurchaseCard, option.popular && styles.giftPurchaseCardPopular]}
                      onPress={() => {
                        setGiftModalVisible(false);
                        if (!iapReady) {
                          Alert.alert('Bilgi', 'Mağaza hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
                          return;
                        }
                        Alert.alert(
                          'Elmas Satın Al',
                          `${option.tokens} elmas satın almak istediğinize emin misiniz?\n\n${option.price}`,
                          [
                            { text: 'İptal', style: 'cancel' },
                            { text: 'Satın Al', onPress: () => handlePurchaseComplete(option.tokens) },
                          ]
                        );
                      }}
                    >
                      {option.popular && (
                        <View style={styles.giftPurchaseBadge}>
                          <Text style={{ fontSize: 10, color: '#fff' }}>En Popüler</Text>
                        </View>
                      )}
                      <Text style={styles.giftPurchaseTokens}>💎 {option.tokens}</Text>
                      <Text style={styles.giftPurchasePrice}>{option.price}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.giftCloseButton}
                onPress={() => setGiftModalVisible(false)}
              >
                <Text style={styles.giftCloseButtonText}>Kapat</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Ses Kaydı Unlock Modal - Temalı */}
        <Modal
          visible={audioUnlockModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAudioUnlockModalVisible(false)}
        >
          <View style={styles.audioUnlockOverlay}>
            <View style={styles.audioUnlockContainer}>
              {/* Icon */}
              <View style={styles.audioUnlockIconWrapper}>
                <Ionicons name="mic" size={32} color={COLORS.primary} />
              </View>
              
              {/* Title */}
              <Text style={styles.audioUnlockTitle}>Ses Kaydı</Text>
              
              {/* Description */}
              <Text style={styles.audioUnlockDescription}>
                Bu ses kaydını dinlemek için{'\n'}
                <Text style={styles.audioUnlockCost}>{pendingAudioCost} 💎</Text> harcanacak
              </Text>
              
              {/* Buttons */}
              <View style={styles.audioUnlockButtons}>
                <TouchableOpacity 
                  style={styles.audioUnlockCancelBtn}
                  onPress={() => {
                    setAudioUnlockModalVisible(false);
                    setPendingAudioMessage(null);
                  }}
                >
                  <Text style={styles.audioUnlockCancelText}>İptal</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.audioUnlockConfirmBtn}
                  onPress={() => {
                    setAudioUnlockModalVisible(false);
                    if (pendingAudioMessage) {
                      handleViewWithElmas(pendingAudioMessage.id).then(success => {
                        if (success) {
                          setViewedMediaIds(prev => new Set(prev).add(pendingAudioMessage.id));
                        }
                      });
                    }
                    setPendingAudioMessage(null);
                  }}
                >
                  <Ionicons name="play" size={18} color="#fff" />
                  <Text style={styles.audioUnlockConfirmText}>Dinle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Medya Seçici Modal (Android için) */}
        {Platform.OS === 'android' && (
          <Modal
            visible={mediaPickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setMediaPickerVisible(false)}
          >
            <View style={styles.mediaPickerOverlay}>
              <TouchableOpacity 
                style={styles.mediaPickerBackdrop}
                activeOpacity={1}
                onPress={() => setMediaPickerVisible(false)}
              />
              <View style={styles.mediaPickerContent}>
                <View style={styles.mediaPickerHandle} />
                
                <Text style={styles.mediaPickerTitle}>
                  {mediaPickerType === 'photo' ? 'Fotoğraf Gönder' : 'Video Gönder'}
                </Text>
                
                <View style={styles.mediaPickerOptions}>
                  <TouchableOpacity 
                    style={styles.mediaPickerOption}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMediaPickerVisible(false);
                      setTimeout(() => {
                        if (mediaPickerType === 'photo') {
                          pickPhotoFromCamera(true);
                        } else {
                          pickVideoFromCamera(true);
                        }
                      }, 300);
                    }}
                  >
                    <View style={[styles.mediaPickerOptionIcon, { backgroundColor: COLORS.accent }]}>
                      <Ionicons name="camera" size={32} color="#fff" />
                    </View>
                    <Text style={styles.mediaPickerOptionText}>Anlık Çek</Text>
                    <Text style={styles.mediaPickerOptionSubtext}>
                      {mediaPickerType === 'photo' ? 'Şimdi fotoğraf çek' : 'Şimdi video çek'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.mediaPickerOption}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMediaPickerVisible(false);
                      setTimeout(() => {
                        if (mediaPickerType === 'photo') {
                          pickPhotoFromGallery(false);
                        } else {
                          pickVideoFromGallery(false);
                        }
                      }, 300);
                    }}
                  >
                    <View style={[styles.mediaPickerOptionIcon, { backgroundColor: '#9b59b6' }]}>
                      <Ionicons name="images" size={32} color="#fff" />
                    </View>
                    <Text style={styles.mediaPickerOptionText}>Galeriden</Text>
                    <Text style={styles.mediaPickerOptionSubtext}>
                      {mediaPickerType === 'photo' ? 'Mevcut fotoğraf seç' : 'Mevcut video seç'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity 
                  style={styles.mediaPickerCancel}
                  activeOpacity={0.7}
                  onPress={() => setMediaPickerVisible(false)}
                >
                  <Text style={styles.mediaPickerCancelText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

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

        {/* Photo View Modal (Kilitleme sistemi ile) */}
        {selectedMedia && selectedMedia.mediaUrl && selectedMedia.mediaUrl.length > 0 && (
          <PhotoViewModal
            visible={photoModalVisible}
            onClose={() => {
              setPhotoModalVisible(false);
              setSelectedMedia(null);
              setIsCurrentMediaFirstFree(false);
              setIsMediaAlreadyPaid(false);
            }}
            onViewed={handleMediaViewed}
            imageUrl={selectedMedia.mediaUrl || 'https://via.placeholder.com/300'}
            thumbnailUrl={selectedMedia.thumbnailUrl} // 🎬 Video thumbnail URL
            messageId={selectedMedia.id}
            mediaType={selectedMedia.mediaType === 'video' ? 'video' : 'photo'}
            isMine={selectedMedia.senderId === user?.id}
            isFirstFreeView={isCurrentMediaFirstFree || isMediaAlreadyPaid}
            elmasCost={selectedMedia.mediaType === 'video' ? ELMAS_COSTS.viewVideo : ELMAS_COSTS.viewPhoto}
            userElmasBalance={instantBalance}
            onViewWithElmas={handleViewWithElmas}
            onRequestElmas={handleRequestElmas}
            onPurchaseElmas={handlePurchaseElmas}
            senderNickname={friendNickname}
            isInstantPhoto={selectedMedia.isInstant || false}
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
                Gerekli: {pendingGiftAmount} 💎 | Mevcut: {instantBalance} 💎
              </Text>
              <View style={styles.purchaseOptions}>
                {PURCHASE_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.tokens}
                    style={[styles.purchaseOption, opt.popular && styles.purchasePopular]}
                    onPress={() => {
                      if (!iapReady) {
                        Alert.alert('Bilgi', 'Mağaza hazır değil. Lütfen kısa süre sonra tekrar deneyin.');
                        return;
                      }
                      Alert.alert(
                        'Elmas Satın Al',
                        `${opt.tokens} elmas satın almak istediğinize emin misiniz?\n\n${opt.price}`,
                        [
                          { text: 'İptal', style: 'cancel' },
                          { text: 'Satın Al', onPress: () => handlePurchaseComplete(opt.tokens) },
                        ]
                      );
                    }}
                  >
                    {opt.popular && <Text style={styles.purchasePopularBadge}>Popüler</Text>}
                    <Text style={styles.purchaseAmount}>💎 {opt.tokens}</Text>
                    <Text style={styles.purchasePrice}>{opt.price}</Text>
                  </TouchableOpacity>
                ))}
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerAvatarEmoji: {
    fontSize: 20,
  },
  headerOnlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B894',
    borderWidth: 2,
    borderColor: COLORS.background,
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
  // Medya Seçici Modal Stilleri
  mediaPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mediaPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mediaPickerContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
    alignItems: 'center',
  },
  mediaPickerHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    marginBottom: SPACING.lg,
  },
  mediaPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xl,
  },
  mediaPickerOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  mediaPickerOption: {
    alignItems: 'center',
    width: 120,
    padding: SPACING.md,
  },
  mediaPickerOptionIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  mediaPickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  mediaPickerOptionSubtext: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  mediaPickerCancel: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    minWidth: 160,
    alignItems: 'center',
  },
  mediaPickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  // ========== Temalı Gift Modal Stilleri ==========
  giftModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  giftModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
    maxHeight: '85%',
  },
  giftModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  giftModalHeader: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  giftModalIconWrapper: {
    marginBottom: SPACING.md,
  },
  giftModalIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  giftModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  giftModalSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  giftBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(125, 212, 212, 0.1)',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(125, 212, 212, 0.2)',
  },
  giftBalanceLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  giftBalanceAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  giftBalanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.accent,
  },
  giftOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  giftOptionCard: {
    flex: 1,
    maxWidth: 110,
    borderRadius: 16,
    overflow: 'hidden',
  },
  giftOptionCardDisabled: {
    opacity: 0.5,
  },
  giftOptionCardGradient: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
  },
  giftPopularTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  giftPopularTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  giftOptionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  giftOptionValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  giftOptionValueDisabled: {
    color: COLORS.textMuted,
  },
  giftOptionDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  giftPurchaseSection: {
    marginBottom: SPACING.lg,
  },
  giftPurchaseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  giftPurchaseScroll: {
    flexGrow: 0,
  },
  giftPurchaseCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    minWidth: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  giftPurchaseCardPopular: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(125, 212, 212, 0.1)',
  },
  giftPurchaseBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  giftPurchaseTokens: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  giftPurchasePrice: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: '600',
  },
  giftCloseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  giftCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  // ========== Audio Unlock Modal ==========
  audioUnlockOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  audioUnlockContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  audioUnlockIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  audioUnlockTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  audioUnlockDescription: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  audioUnlockCost: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  audioUnlockButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xl,
    width: '100%',
  },
  audioUnlockCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  audioUnlockCancelText: {
    ...FONTS.button,
    color: COLORS.textMuted,
  },
  audioUnlockConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  audioUnlockConfirmText: {
    ...FONTS.button,
    color: '#fff',
    fontWeight: '600',
  },
});

export default FriendChatScreen;
