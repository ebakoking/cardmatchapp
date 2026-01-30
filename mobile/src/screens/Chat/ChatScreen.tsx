import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MessageBubble from '../../components/MessageBubble';
import StageIndicator from '../../components/StageIndicator';
import PhotoViewModal from '../../components/PhotoViewModal';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

type Props = NativeStackScreenProps<ChatStackParamList, 'Chat'>;

// Stage bazlı özellik kilitleri (YENİ SİSTEM)
const FEATURE_UNLOCKS = {
  gift: 1,       // Stage 1'den itibaren açık
  audio: 2,      // Stage 2'de açılır (ses kaydı)
  photo: 3,      // Stage 3'te açılır
  video: 4,      // Stage 4'te açılır
  friend: 5,     // Stage 5'te açılır
};

// Token maliyetleri - YENİ SİSTEM
const TOKEN_COSTS = {
  viewAudio: 5,   // Ses açma: 5 token
  viewPhoto: 20,  // Fotoğraf açma: 20 token
  viewVideo: 50,  // Video açma: 50 token
};

// Hızlı satın alma seçenekleri
const PURCHASE_OPTIONS = [
  { tokens: 50, price: '₺29.90' },
  { tokens: 100, price: '₺49.90' },
  { tokens: 500, price: '₺199.90' },
];

interface ChatMessage {
  id: string;
  senderId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  messageType?: 'TEXT' | 'MEDIA' | 'TOKEN_GIFT' | 'SYSTEM'; // YENİ: Message type
  tokenAmount?: number; // YENİ: TOKEN_GIFT için miktar
  senderNickname?: string; // TOKEN_GIFT için gönderen adı
  receiverId?: string; // TOKEN_GIFT için alıcı ID
  receiverNickname?: string; // TOKEN_GIFT için alıcı adı
  isInstant?: boolean; // Anlık mı galeri mi
  isViewed?: boolean; // Görüntülendi mi
  createdAt?: string; // Zaman damgası
  // Sistem mesajı için (eski format - geriye uyumluluk)
  isSystem?: boolean;
  systemType?: 'gift' | 'stage' | 'info' | 'friend';
  systemData?: {
    fromNickname?: string;
    amount?: number;
    newStage?: number;
  };
}

// Stage süreleri (saniye cinsinden)
const STAGE_DURATION = 10; // TEST İÇİN 10 SANİYE
const STAGE_THRESHOLDS = [0, 10, 20, 30, 40]; // Stage başlangıç süreleri (10 sn aralık)

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { sessionId, partnerNickname, partnerId } = route.params;
  const { user, addTokens, deductTokens, updateTokenBalance } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [stage, setStage] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(STAGE_DURATION); // Stage için kalan süre
  const [sessionStartTime] = useState(Date.now()); // Session başlangıç zamanı
  const [isEnded, setIsEnded] = useState(false);
  const [giftModalVisible, setGiftModalVisible] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  
  // Block/Report menü state
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportCategory, setReportCategory] = useState<string>('');
  const [reportDescription, setReportDescription] = useState('');
  
  // Photo view modal state
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<ChatMessage | null>(null);
  const [isCurrentMediaFirstFree, setIsCurrentMediaFirstFree] = useState(false); // İlk ücretsiz hak mı?
  const [isMediaAlreadyPaid, setIsMediaAlreadyPaid] = useState(false); // Token zaten ödendi mi?
  
  // Her medya türü için ayrı ilk ücretsiz hak
  const [freeMediaUsed, setFreeMediaUsed] = useState({
    photo: false,
    video: false,
    audio: false,
  });
  const [viewedMediaIds, setViewedMediaIds] = useState<Set<string>>(new Set()); // Görüntülenen medyalar
  const [listenedAudioIds, setListenedAudioIds] = useState<Set<string>>(new Set()); // Dinlenmiş sesler (ephemeral)

  // FlatList ref (auto-scroll için)
  const flatListRef = useRef<FlatList>(null);

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
  
  // Ses kaydı önizleme modal state
  const [audioPreviewVisible, setAudioPreviewVisible] = useState(false);

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
      `${partnerNickname} kullanıcısını engellemek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/api/user/block', { blockedUserId: partnerId });
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
      Alert.alert('Rapor Gönderildi', 'Raporunuz incelenecektir. Teşekkür ederiz.');
      setReportModalVisible(false);
      setReportCategory('');
      setReportDescription('');
      setMenuModalVisible(false);
    } catch (error) {
      Alert.alert('Hata', 'Rapor gönderilemedi.');
    }
  };

  useEffect(() => {
    const socket = getSocket();
    socket.emit('chat:join', { sessionId, userId: user?.id });

    socket.on('chat:message', (msg: ChatMessage & { chatSessionId?: string }) => {
      if (msg.chatSessionId && msg.chatSessionId !== sessionId) return;
      setMessages((prev) => [...prev, msg]);
    });

    socket.on(
      'stage:advanced',
      (payload: { newStage: number; features: string[] }) => {
        console.log('[ChatScreen] stage:advanced from server:', payload);
        setStage(payload.newStage);
        // Timer client tarafında yönetiliyor, burada set etmeye gerek yok
      },
    );

    // Sohbet sonlandığında (karşı taraf çıktığında)
    socket.on(
      'chat:ended',
      (payload: { sessionId: string; reason: string; message: string }) => {
        console.log('[ChatScreen] chat:ended received:', payload);
        if (payload.sessionId !== sessionId) return;
        if (isEnded) return; // Zaten sonlanmış
        setIsEnded(true);
        
        // Karşı taraf çıktıysa alert göster
        if (payload.reason !== 'self') {
          Alert.alert('Sohbet Sona Erdi', payload.message, [
            { text: 'Tamam', onPress: goToHome },
          ]);
        }
      },
    );

    // Jeton hediye alındığında (alıcı tarafında) - SADECE BAKİYE GÜNCELLE
    socket.on(
      'gift:received',
      (payload: { fromUserId: string; amount: number; fromNickname: string; newBalance: number; messageId: string }) => {
        console.log('[ChatScreen] gift:received - updating balance to:', payload.newBalance);
        // Bakiyeyi güncelle (mesaj zaten chat:message ile geliyor)
        updateTokenBalance(payload.newBalance);
      },
    );

    // Jeton gönderildiğinde (gönderen tarafında) - SADECE BAKİYE GÜNCELLE
    socket.on(
      'gift:sent',
      (payload: { toUserId: string; amount: number; newBalance: number; messageId: string }) => {
        console.log('[ChatScreen] gift:sent - updating balance to:', payload.newBalance);
        // Bakiyeyi güncelle (mesaj zaten chat:message ile geliyor)
        updateTokenBalance(payload.newBalance);
      },
    );

    // Hediye hatası
    socket.on(
      'gift:error',
      (payload: { code: string; message: string; balance?: number; required?: number }) => {
        console.log('[ChatScreen] gift:error:', payload);
        if (payload.code === 'INSUFFICIENT_BALANCE') {
          Alert.alert(
            'Yetersiz Bakiye',
            `${payload.required} jeton gerekiyor.\nBakiyeniz: ${payload.balance || 0}`,
            [
              { text: 'İptal', style: 'cancel' },
              { text: 'Jeton Satın Al', onPress: () => setGiftModalVisible(true) },
            ],
          );
        } else {
          Alert.alert('Hata', payload.message);
        }
      },
    );

    // Arkadaşlık bilgi mesajı (karşılıklı istek olduğunda)
    socket.on('friend:info', (payload: { message: string }) => {
      console.log('[ChatScreen] friend:info:', payload);
      Alert.alert('Arkadaşlık', payload.message);
    });

    // Arkadaşlık kabul edildiğinde (karşılıklı istek durumunda otomatik)
    socket.on('friend:accepted', (payload: { friendshipId: string; user1Id: string; user2Id: string }) => {
      console.log('[ChatScreen] friend:accepted:', payload);
      // Eğer bu arkadaşlık beni ilgilendiriyorsa
      if (payload.user1Id === user?.id || payload.user2Id === user?.id) {
        setFriendRequestSent(true);
        // Chat'e sistem mesajı ekle
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

    // Cleanup: Ekrandan çıkılınca leave emit et
    return () => {
      console.log('[ChatScreen] Cleanup - emitting chat:leave');
      socket.emit('chat:leave', { sessionId, userId: user?.id });
      socket.off('chat:message');
      socket.off('stage:advanced');
      socket.off('chat:ended');
      socket.off('gift:received');
      socket.off('gift:sent');
      socket.off('gift:error');
      socket.off('friend:info');
      socket.off('friend:accepted');
    };
  }, [sessionId, user?.id]);

  // Otomatik stage geçişi ve timer
  useEffect(() => {
    const socket = getSocket();
    
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
      
      // Hangi stage'deyiz hesapla
      let newStage = 1;
      for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (elapsedSeconds >= STAGE_THRESHOLDS[i]) {
          newStage = i + 1;
          break;
        }
      }
      
      // Stage 5'ten sonra geçiş yok
      if (newStage > 5) newStage = 5;
      
      // Stage değiştiyse güncelle
      if (newStage !== stage && newStage <= 5) {
        console.log(`[ChatScreen] Stage changed: ${stage} -> ${newStage}`);
        setStage(newStage);
        // Backend'e bildir
        socket.emit('stage:advance', { sessionId, stage: newStage });
      }
      
      // Kalan süreyi hesapla (mevcut stage için)
      if (newStage < 5) {
        const stageStartTime = STAGE_THRESHOLDS[newStage - 1];
        const nextStageTime = STAGE_THRESHOLDS[newStage] || STAGE_THRESHOLDS[newStage - 1] + STAGE_DURATION;
        const remaining = Math.max(0, nextStageTime - elapsedSeconds);
        setTimeRemaining(remaining);
      } else {
        // Stage 5'te sınırsız süre
        setTimeRemaining(0);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [sessionStartTime, stage, sessionId]);

  // Yeni mesaj gelince otomatik scroll (en alta)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = () => {
    if (!input.trim() || !user || isEnded) return;
    const socket = getSocket();
    socket.emit('chat:message', {
      sessionId,
      senderId: user.id,
      content: input.trim(),
    });
    setInput('');
  };

  // Sohbetten çık
  const handleLeaveChat = () => {
    Alert.alert(
      'Sohbetten Çık',
      'Sohbetten çıkmak istediğinize emin misiniz? Bu işlem geri alınamaz.',
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
            // Hemen home'a git
            goToHome();
          },
        },
      ],
    );
  };

  // Fotoğraf gönder - Seçenek modalı göster
  const handleSendPhoto = () => {
    if (isFeatureLocked('photo')) {
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

  // Kameradan anlık fotoğraf
  const sendPhotoFromCamera = async (isInstant: boolean) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('İzin Gerekli', 'Kamera izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false, // Tam boyut
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      sendPhoto(result.assets[0].uri, isInstant);
    }
  };

  // Galeriden fotoğraf
  const sendPhotoFromGallery = async (isInstant: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Tam boyut
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      sendPhoto(result.assets[0].uri, isInstant);
    }
  };

  // Fotoğrafı gönder
  const sendPhoto = (uri: string, isInstant: boolean) => {
    const socket = getSocket();
    socket.emit('media:photo', {
      sessionId,
      senderId: user?.id,
      url: uri,
      isInstant,
    });
    Alert.alert('Başarılı', isInstant ? 'Anlık fotoğraf gönderildi!' : 'Galeri fotoğrafı gönderildi!');
  };

  // Video gönder
  const handleSendVideo = async () => {
    if (isFeatureLocked('video')) {
      Alert.alert('Kilitli', `Video göndermek için Seviye ${FEATURE_UNLOCKS.video}'ye ulaşmalısınız.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 15, // 15 saniye max
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const socket = getSocket();
      // TODO: Önce videoyu upload et, sonra URL'i gönder
      socket.emit('media:video', {
        sessionId,
        senderId: user?.id,
        url: result.assets[0].uri,
      });
      Alert.alert('Başarılı', 'Video gönderildi!');
    }
  };

  // Arkadaş ekle
  const handleAddFriend = () => {
    if (isFeatureLocked('friend')) {
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
    Alert.alert('Başarılı', 'Arkadaşlık isteği gönderildi!');
  };

  // Ses butonuna tap - kayıt başlat/durdur
  const handleAudioTap = async () => {
    if (isFeatureLocked('audio')) {
      Alert.alert('Kilitli', `Ses göndermek için Seviye ${FEATURE_UNLOCKS.audio}'e ulaşmalısınız.`);
      return;
    }

    if (isRecording) {
      // Kayıt devam ediyorsa durdur ve önizlemeye geç
      const audioUri = await stopRecording();
      if (audioUri) {
        setAudioPreviewVisible(true);
      }
    } else {
      // Kayıt yok, başlat
      await startRecording();
    }
  };

  // Ses kaydı iptal (kayıt sırasında)
  const handleCancelRecording = async () => {
    await cancelRecording();
  };

  // Önizlemeden ses gönder (önce upload et)
  const handleConfirmSendAudio = async () => {
    if (!recordedUri) return;

    console.log('[ChatScreen] Uploading audio:', recordedUri);
    
    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append('audio', {
        uri: recordedUri,
        type: 'audio/m4a',
        name: `audio_${Date.now()}.m4a`,
      } as any);

      // Backend'e upload et - api.ts'deki baseURL'i kullan
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

      // Başarılı - artık URL'i gönder
      const socket = getSocket();
      socket.emit('media:audio', {
        sessionId,
        senderId: user?.id,
        url: data.url, // Server'dan dönen public URL
        duration: recordedDuration,
      });
      
      // Temizle ve modalı kapat
      clearRecording();
      setAudioPreviewVisible(false);
    } catch (error) {
      console.error('[ChatScreen] Audio upload error:', error);
      Alert.alert('Hata', 'Ses dosyası yüklenemedi. Lütfen tekrar deneyin.');
    }
  };

  // Önizlemeyi iptal et (sil)
  const handleDiscardAudio = () => {
    clearRecording();
    setAudioPreviewVisible(false);
  };

  // Jeton gönder
  const handleSendGift = (amount: number) => {
    if (isFeatureLocked('gift')) {
      Alert.alert('Kilitli', `Jeton göndermek için Seviye ${FEATURE_UNLOCKS.gift}'e ulaşmalısınız.`);
      return;
    }

    if (!user || (user.tokenBalance || 0) < amount) {
      Alert.alert(
        'Yetersiz Bakiye', 
        `${amount} jeton gerekiyor.\nBakiyeniz: ${user?.tokenBalance || 0}`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Jeton Satın Al', onPress: () => {} }, // Modal zaten açık
        ],
      );
      return;
    }

    const socket = getSocket();
    console.log('[ChatScreen] Sending gift:', { fromUserId: user?.id, toUserId: partnerId, sessionId, amount });
    socket.emit('gift:send', {
      fromUserId: user?.id,
      toUserId: partnerId,
      sessionId,
      amount,
    });
    
    // NOT: Bakiye backend'den gift:sent event'i ile güncellenecek
    setGiftModalVisible(false);
  };

  // Hızlı jeton satın alma (mock - socket üzerinden backend'e yansır)
  const handleQuickPurchase = (tokens: number) => {
    Alert.alert(
      'Jeton Satın Al',
      `${tokens} jeton satın almak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Satın Al',
          onPress: () => {
            // Socket üzerinden backend'e mock satın alma isteği gönder
            const socket = getSocket();
            socket.emit('tokens:mock_purchase', {
              userId: user?.id,
              amount: tokens,
            });
            // NOT: Optimistic update KALDIRILDI - Backend'den gelen token:balance_updated event'i ile güncellenecek
            // Bu sayede çift ekleme sorunu çözüldü
            Alert.alert('Başarılı', `${tokens} jeton hesabınıza eklendi!`);
          },
        },
      ]
    );
  };

  // Medyaya tıklama (fotoğraf/video/ses görüntüleme)
  const handleMediaPress = (message: ChatMessage) => {
    // Medya türünü belirle
    const mediaType = message.mediaType === 'video' ? 'video' : 
                      message.mediaType === 'audio' ? 'audio' : 'photo';

    // SES MESAJI İÇİN ÖZEL İŞLEM
    if (mediaType === 'audio') {
      handleAudioPress(message);
      return;
    }

    // 1. KENDİ MESAJIMIZ - sınırsız görüntüleme
    if (message.senderId === user?.id) {
      setSelectedMedia(message);
      setPhotoModalVisible(true);
      return;
    }

    // 2. EPHEMERAL: Zaten görüntülenmiş medya TEKRAR AÇILAMAZ (sessizce hiçbir şey yapma)
    if (viewedMediaIds.has(message.id)) {
      // Kullanıcıya bilgi ver ama açma
      return; // Sessizce hiçbir şey yapma - UI'da zaten "Görüntülendi" yazacak
    }
    
    // 3. Karşı taraftan gelen aynı türdeki medyaların index'ini hesapla
    const otherMediaOfType = messages.filter(m => 
      m.senderId !== user?.id && 
      m.mediaUrl && 
      (mediaType === 'photo' ? (!m.mediaType || m.mediaType === 'photo') : m.mediaType === mediaType)
    );
    const mediaIndex = otherMediaOfType.findIndex(m => m.id === message.id);
    
    // 4. İLK MEDYA ÜCRETSİZ - MODAL YOK, DİREKT AÇ
    const isFirstFree = mediaIndex === 0 && !freeMediaUsed[mediaType];
    
    if (isFirstFree) {
      console.log(`[ChatScreen] First ${mediaType} is FREE, opening directly...`);
      // State'i set et - modal'a bu bilgiyi geçireceğiz
      setIsCurrentMediaFirstFree(true);
      // Modal'ı aç (otomatik unlock olacak)
      setSelectedMedia(message);
      setPhotoModalVisible(true);
      // NOT: freeMediaUsed ve viewedMediaIds modal kapandığında güncellenecek
      return;
    }

    // 5. İKİNCİ VE SONRAKİ MEDYALAR - TOKEN KONTROLÜ
    const tokenCost = mediaType === 'video' ? TOKEN_COSTS.viewVideo : TOKEN_COSTS.viewPhoto;
    
    if ((user?.tokenBalance || 0) < tokenCost) {
      // Bakiye yetersiz
      Alert.alert(
        'Yetersiz Jeton',
        `Bu ${mediaType === 'photo' ? 'fotoğrafı' : 'videoyu'} görmek için ${tokenCost} jeton gerekiyor.\nBakiyeniz: ${user?.tokenBalance || 0}`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Jeton Satın Al', onPress: () => setGiftModalVisible(true) },
        ],
      );
      return;
    }

    // 6. BAKİYE YETERLİ - Token harcama onayı iste
    Alert.alert(
      'Medya Aç',
      `Bu ${mediaType === 'photo' ? 'fotoğrafı' : 'videoyu'} ${tokenCost} jeton karşılığında açmak ister misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: `Aç (${tokenCost} Jeton)`, 
          onPress: () => {
            // Token harca (backend'e emit) - backend token:spent event'i ile güncelleyecek
            const socket = getSocket();
            socket.emit('media:view', {
              messageId: message.id,
              userId: user?.id,
            });
            // Hemen işaretle
            setViewedMediaIds(prev => new Set(prev).add(message.id));
            // NOT: deductTokens KALDIRILDI - Backend'den token:spent event'i ile güncellenecek
            // Modal'a "zaten ödendi" bilgisini geç
            setIsMediaAlreadyPaid(true);
            // Modal'ı aç
            setSelectedMedia(message);
            setPhotoModalVisible(true);
          }
        },
      ],
    );
  };

  // Ses mesajına tıklama - ayrı işlem
  const handleAudioPress = (message: ChatMessage) => {
    // Kendi mesajımız ise zaten unlocked
    if (message.senderId === user?.id) {
      // AudioMessage componenti kendi başına çalacak
      return;
    }

    // Zaten açılmış mı?
    if (viewedMediaIds.has(message.id)) {
      // Ses zaten açık, AudioMessage kendi çalacak
      return;
    }

    // Karşı taraftan gelen seslerin index'ini hesapla
    const otherAudios = messages.filter(m => 
      m.senderId !== user?.id && m.mediaType === 'audio'
    );
    const audioIndex = otherAudios.findIndex(m => m.id === message.id);

    // İLK SES ÜCRETSİZ - direkt aç
    if (audioIndex === 0 && !freeMediaUsed.audio) {
      console.log('[ChatScreen] First audio is FREE, unlocking...');
      setFreeMediaUsed(prev => ({ ...prev, audio: true }));
      setViewedMediaIds(prev => new Set(prev).add(message.id));
      // AudioMessage componenti otomatik çalacak
      return;
    }

    // Sonraki sesler için TOKEN KONTROLÜ
    const tokenCost = TOKEN_COSTS.viewAudio;
    
    if ((user?.tokenBalance || 0) < tokenCost) {
      Alert.alert(
        'Yetersiz Jeton',
        `Bu ses kaydını dinlemek için ${tokenCost} jeton gerekiyor.\nBakiyeniz: ${user?.tokenBalance || 0}`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Jeton Satın Al', onPress: () => setGiftModalVisible(true) },
        ],
      );
      return;
    }

    // Bakiye yeterli - token harca ve aç
    Alert.alert(
      'Ses Kaydı',
      `Bu ses kaydını dinlemek için ${tokenCost} jeton harcanacak.\n⚠️ Dikkat: Ses bir kez dinlenebilir!`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: `Dinle (${tokenCost} jeton)`,
          onPress: () => {
            // Token harca
            const socket = getSocket();
            socket.emit('media:view', {
              messageId: message.id,
              userId: user?.id,
              cost: tokenCost,
            });
            setViewedMediaIds(prev => new Set(prev).add(message.id));
          },
        },
      ],
    );
  };

  // Ses dinlendiğinde (ephemeral - bir kez dinleme)
  const handleAudioListened = (messageId: string) => {
    console.log('[ChatScreen] Audio listened (ephemeral):', messageId);
    setListenedAudioIds(prev => new Set(prev).add(messageId));
  };

  // Token ile medya görüntüleme
  const handleViewWithTokens = async (messageId: string): Promise<boolean> => {
    const mediaType = selectedMedia?.mediaType === 'video' ? 'video' : 
                      selectedMedia?.mediaType === 'audio' ? 'audio' : 'photo';
    const cost = mediaType === 'video' ? TOKEN_COSTS.viewVideo : TOKEN_COSTS.viewPhoto;
    
    // İlk ücretsiz hak varsa (her medya türü için ayrı)
    if (!freeMediaUsed[mediaType]) {
      setFreeMediaUsed(prev => ({ ...prev, [mediaType]: true }));
      setViewedMediaIds((prev) => new Set(prev).add(messageId));
      return true;
    }

    // Token kontrolü
    if (!user || (user.tokenBalance || 0) < cost) {
      return false;
    }

    // Backend'e token harcama emit et
    const socket = getSocket();
    socket.emit('media:view', {
      messageId,
      userId: user.id,
      cost,
    });

    // Local state güncelle
    setViewedMediaIds((prev) => new Set(prev).add(messageId));
    return true;
  };

  // Token isteme
  const handleRequestTokens = () => {
    const socket = getSocket();
    socket.emit('token:request', {
      fromUserId: user?.id,
      toUserId: partnerId,
      sessionId,
    });
    Alert.alert('Gönderildi', 'Token isteğiniz gönderildi!');
    setPhotoModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeaveChat} style={styles.leaveButton}>
          <Text style={styles.leaveButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={FONTS.h3}>{partnerNickname}</Text>
        </View>
        <StageIndicator currentStage={stage} timeRemaining={timeRemaining} totalDuration={STAGE_DURATION} />
        <TouchableOpacity onPress={() => setMenuModalVisible(true)} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // Medya türünü belirle
          const mediaType = item.mediaType === 'video' ? 'video' : 
                            item.mediaType === 'audio' ? 'audio' : 'photo';
          
          // Karşı taraftan gelen aynı türdeki medyaların index'ini hesapla
          const isOtherMedia = item.senderId !== user?.id && item.mediaUrl;
          
          let mediaIndex = 0;
          if (isOtherMedia) {
            const otherMediaOfType = messages.filter(m => 
              m.senderId !== user?.id && 
              m.mediaUrl && 
              (mediaType === 'photo' ? (!m.mediaType || m.mediaType === 'photo') : m.mediaType === mediaType)
            );
            mediaIndex = otherMediaOfType.findIndex(m => m.id === item.id);
          }
          
          // İlk ücretsiz hak kontrolü (her medya türü için ayrı)
          const isFirstFreeView = !freeMediaUsed[mediaType] && 
                                  item.senderId !== user?.id && 
                                  mediaIndex === 0;
          
          // DEBUG LOG
          if (item.mediaUrl && item.senderId !== user?.id) {
            console.log(`[ChatScreen] Media item: type=${mediaType}, index=${mediaIndex}, freeUsed=${freeMediaUsed[mediaType]}, isFirstFree=${isFirstFreeView}`);
          }
          
          // Medya açık mı? (kendi mesajı, token harcandı veya ilk ücretsiz kullanıldı)
          const isMediaUnlocked = item.senderId === user?.id || 
                                  viewedMediaIds.has(item.id) ||
                                  (mediaIndex === 0 && freeMediaUsed[mediaType]);
          
          return (
            <MessageBubble
              message={item}
              isMine={item.senderId === user?.id}
              onMediaPress={handleMediaPress}
              isFirstFreeView={isFirstFreeView}
              photoIndex={mediaIndex}
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

      {/* Özellik Toolbar - YENİ SIRALAMA */}
      <View style={styles.toolbar}>
        {/* Jeton - Stage 1'den itibaren açık */}
        <TouchableOpacity
          style={[styles.toolbarButton, isFeatureLocked('gift') && styles.toolbarButtonLocked]}
          onPress={() => !isFeatureLocked('gift') && setGiftModalVisible(true)}
        >
          <Text style={styles.toolbarIcon}>🎁</Text>
          <Text style={[styles.toolbarLabel, isFeatureLocked('gift') && styles.toolbarLabelLocked]}>
            {isFeatureLocked('gift') ? '🔒' : 'Jeton'}
          </Text>
        </TouchableOpacity>

        {/* Ses - Stage 2 (TAP = kayıt başlat/durdur) */}
        {isRecording ? (
          // Kayıt aktif - Durdur ve İptal butonları
          <View style={styles.recordingControls}>
            <TouchableOpacity
              style={styles.recordingCancelButton}
              onPress={handleCancelRecording}
            >
              <Text style={styles.recordingCancelIcon}>✕</Text>
            </TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingDot}>🔴</Text>
              <Text style={styles.recordingTime}>{recordingDuration}s / 30s</Text>
            </View>
            <TouchableOpacity
              style={styles.recordingStopButton}
              onPress={handleAudioTap}
            >
              <Text style={styles.recordingStopIcon}>⏹️</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Normal mikrofon butonu
          <TouchableOpacity
            style={[
              styles.toolbarButton, 
              isFeatureLocked('audio') && styles.toolbarButtonLocked,
            ]}
            onPress={handleAudioTap}
          >
            <Text style={styles.toolbarIcon}>🎵</Text>
            <Text style={[styles.toolbarLabel, isFeatureLocked('audio') && styles.toolbarLabelLocked]}>
              {isFeatureLocked('audio') ? '🔒' : 'Ses'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Fotoğraf - Stage 3 */}
        <TouchableOpacity
          style={[styles.toolbarButton, isFeatureLocked('photo') && styles.toolbarButtonLocked]}
          onPress={handleSendPhoto}
        >
          <Text style={styles.toolbarIcon}>📷</Text>
          <Text style={[styles.toolbarLabel, isFeatureLocked('photo') && styles.toolbarLabelLocked]}>
            {isFeatureLocked('photo') ? '🔒' : 'Foto'}
          </Text>
        </TouchableOpacity>

        {/* Video - Stage 4 */}
        <TouchableOpacity
          style={[styles.toolbarButton, isFeatureLocked('video') && styles.toolbarButtonLocked]}
          onPress={handleSendVideo}
        >
          <Text style={styles.toolbarIcon}>🎥</Text>
          <Text style={[styles.toolbarLabel, isFeatureLocked('video') && styles.toolbarLabelLocked]}>
            {isFeatureLocked('video') ? '🔒' : 'Video'}
          </Text>
        </TouchableOpacity>

        {/* Arkadaş - Stage 5 */}
        <TouchableOpacity
          style={[
            styles.toolbarButton,
            isFeatureLocked('friend') && styles.toolbarButtonLocked,
            friendRequestSent && styles.toolbarButtonDisabled,
          ]}
          onPress={handleAddFriend}
          disabled={friendRequestSent}
        >
          <Text style={styles.toolbarIcon}>👤</Text>
          <Text style={[styles.toolbarLabel, isFeatureLocked('friend') && styles.toolbarLabelLocked]}>
            {isFeatureLocked('friend') ? '🔒' : friendRequestSent ? '✓' : 'Ekle'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mesaj Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Mesajınızı yazın..."
          placeholderTextColor={COLORS.textMuted}
          value={input}
          onChangeText={setInput}
          editable={!isEnded}
        />
        <TouchableOpacity 
          style={[styles.sendButton, isEnded && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={isEnded}
        >
          <Text style={FONTS.button}>Gönder</Text>
        </TouchableOpacity>
      </View>

      {/* Jeton Gönder Modal */}
      <Modal
        visible={giftModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGiftModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Jeton Gönder</Text>
            <Text style={styles.modalSubtitle}>
              💎 Bakiye: {user?.tokenBalance || 0} jeton
            </Text>
            
            <View style={styles.giftOptions}>
              {[10, 50, 100].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.giftOption,
                    (user?.tokenBalance || 0) < amount && styles.giftOptionDisabled,
                  ]}
                  onPress={() => handleSendGift(amount)}
                  disabled={(user?.tokenBalance || 0) < amount}
                >
                  <Text style={styles.giftAmount}>{amount}</Text>
                  <Text style={styles.giftLabel}>jeton</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hızlı Jeton Yükle Bölümü */}
            <View style={styles.purchaseSection}>
              <Text style={styles.purchaseTitle}>💰 Hızlı Jeton Yükle</Text>
              <View style={styles.purchaseOptions}>
                {PURCHASE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.tokens}
                    style={styles.purchaseOption}
                    onPress={() => handleQuickPurchase(option.tokens)}
                  >
                    <Text style={styles.purchaseTokens}>{option.tokens} 💎</Text>
                    <Text style={styles.purchasePrice}>{option.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setGiftModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Menü Modal (Block/Report) */}
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
            
            <TouchableOpacity 
              style={styles.menuOption}
              onPress={() => {
                setMenuModalVisible(false);
                setReportModalVisible(true);
              }}
            >
              <Text style={styles.menuOptionText}>🚩 Bildir</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuOption, styles.menuOptionDanger]}
              onPress={handleBlockUser}
            >
              <Text style={[styles.menuOptionText, styles.menuOptionDangerText]}>
                🚫 Engelle
              </Text>
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
            <Text style={styles.reportModalTitle}>Kullanıcıyı Bildir</Text>
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
                <Text style={[
                  styles.reportCategoryText,
                  reportCategory === cat && styles.reportCategoryTextActive,
                ]}>
                  {cat === 'SPAM' && '📧 Spam'}
                  {cat === 'HARASSMENT' && '😡 Taciz'}
                  {cat === 'FAKE_PROFILE' && '🎭 Sahte Profil'}
                  {cat === 'INAPPROPRIATE_CONTENT' && '🔞 Uygunsuz İçerik'}
                  {cat === 'OTHER' && '❓ Diğer'}
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

      {/* Fotoğraf/Video Görüntüleme Modal */}
      {selectedMedia && (
        <PhotoViewModal
          visible={photoModalVisible}
          onClose={() => {
            setPhotoModalVisible(false);
            setSelectedMedia(null);
            setIsCurrentMediaFirstFree(false); // Reset
            setIsMediaAlreadyPaid(false); // Reset
          }}
          onViewed={(msgId, mType) => {
            // EPHEMERAL: Görüntülenen medyayı işaretle (tekrar açılamaz)
            console.log(`[ChatScreen] Media viewed (ephemeral): ${msgId}, type: ${mType}`);
            setViewedMediaIds(prev => new Set(prev).add(msgId));
            // İlk ücretsiz hak kullanıldıysa işaretle
            if (!freeMediaUsed[mType]) {
              setFreeMediaUsed(prev => ({ ...prev, [mType]: true }));
            }
          }}
          imageUrl={selectedMedia.mediaUrl || ''}
          messageId={selectedMedia.id}
          mediaType={selectedMedia.mediaType === 'video' ? 'video' : 'photo'}
          isMine={selectedMedia.senderId === user?.id}
          isFirstFreeView={isCurrentMediaFirstFree || isMediaAlreadyPaid}
          tokenCost={selectedMedia.mediaType === 'video' ? TOKEN_COSTS.viewVideo : TOKEN_COSTS.viewPhoto}
          userTokenBalance={user?.tokenBalance || 0}
          onViewWithTokens={handleViewWithTokens}
          onRequestTokens={handleRequestTokens}
          onPurchaseTokens={() => {
            setPhotoModalVisible(false);
            setSelectedMedia(null);
            setGiftModalVisible(true); // Satın alma modalını aç
          }}
          senderNickname={partnerNickname}
          isInstantPhoto={selectedMedia.isInstant || false}
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
            <Text style={styles.audioPreviewTitle}>🎵 Ses Kaydı</Text>
            <Text style={styles.audioPreviewDuration}>{recordedDuration} saniye</Text>
            
            {/* Play/Pause Button */}
            <TouchableOpacity 
              style={styles.audioPreviewPlayButton}
              onPress={isPlayingPreview ? stopPreview : playPreview}
            >
              <Text style={styles.audioPreviewPlayIcon}>
                {isPlayingPreview ? '⏸️' : '▶️'}
              </Text>
              <Text style={styles.audioPreviewPlayText}>
                {isPlayingPreview ? 'Durdur' : 'Dinle'}
              </Text>
            </TouchableOpacity>

            {/* Actions */}
            <View style={styles.audioPreviewActions}>
              <TouchableOpacity 
                style={styles.audioPreviewDiscardButton}
                onPress={handleDiscardAudio}
              >
                <Text style={styles.audioPreviewDiscardText}>🗑️ Sil</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.audioPreviewSendButton}
                onPress={handleConfirmSendAudio}
              >
                <Text style={styles.audioPreviewSendText}>📤 Gönder</Text>
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
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonText: {
    color: COLORS.error,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
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
    borderRadius: 8,
  },
  toolbarButtonLocked: {
    opacity: 0.4,
  },
  // Kayıt sırasında görünen kontrol butonları
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
  recordingCancelIcon: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.sm,
  },
  recordingDot: {
    fontSize: 12,
    marginRight: 4,
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
  recordingStopIcon: {
    fontSize: 16,
  },
  toolbarButtonDisabled: {
    opacity: 0.6,
  },
  toolbarIcon: {
    fontSize: 24,
  },
  toolbarLabel: {
    fontSize: 10,
    color: COLORS.text,
    marginTop: 2,
  },
  toolbarLabelLocked: {
    color: COLORS.textMuted,
  },
  // Input Row Styles
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    ...FONTS.h2,
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  giftOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: SPACING.lg,
  },
  giftOption: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  giftOptionDisabled: {
    backgroundColor: COLORS.textMuted,
    opacity: 0.5,
  },
  giftAmount: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  giftLabel: {
    ...FONTS.caption,
    color: COLORS.text,
  },
  purchaseSection: {
    width: '100%',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
  },
  purchaseTitle: {
    ...FONTS.body,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    color: COLORS.accent,
  },
  purchaseOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  purchaseOption: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  purchaseTokens: {
    ...FONTS.body,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  purchasePrice: {
    ...FONTS.caption,
    color: COLORS.accent,
  },
  modalCloseButton: {
    paddingVertical: SPACING.sm,
  },
  modalCloseText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  // Ses Önizleme Modal Stilleri
  audioPreviewModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    width: '80%',
    alignItems: 'center',
  },
  audioPreviewTitle: {
    ...FONTS.h2,
    marginBottom: SPACING.xs,
  },
  audioPreviewDuration: {
    ...FONTS.body,
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
  },
  audioPreviewPlayIcon: {
    fontSize: 24,
    marginRight: SPACING.sm,
  },
  audioPreviewPlayText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  audioPreviewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  audioPreviewDiscardButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginRight: SPACING.sm,
    alignItems: 'center',
  },
  audioPreviewDiscardText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  audioPreviewSendButton: {
    flex: 1,
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginLeft: SPACING.sm,
    alignItems: 'center',
  },
  audioPreviewSendText: {
    ...FONTS.button,
    color: COLORS.text,
  },
  // Menu button
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  menuButtonText: {
    fontSize: 24,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  // Menu modal
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl + 20,
  },
  menuModalTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  menuOption: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuOptionText: {
    ...FONTS.body,
    color: COLORS.text,
    textAlign: 'center',
  },
  menuOptionDanger: {
    borderBottomWidth: 0,
  },
  menuOptionDangerText: {
    color: COLORS.danger,
  },
  menuOptionCancel: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  menuOptionCancelText: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Report modal
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  reportModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
  },
  reportModalTitle: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  reportModalSubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
  },
  reportCategoryButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  reportCategoryButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
  },
  reportCategoryText: {
    ...FONTS.body,
    color: COLORS.text,
  },
  reportCategoryTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  reportDescriptionInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.md,
    color: COLORS.text,
    minHeight: 80,
    marginTop: SPACING.md,
    textAlignVertical: 'top',
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
    ...FONTS.button,
    color: COLORS.textSecondary,
  },
  reportSubmitButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    alignItems: 'center',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.5,
  },
  reportSubmitText: {
    ...FONTS.button,
    color: COLORS.text,
  },
});

export default ChatScreen;

