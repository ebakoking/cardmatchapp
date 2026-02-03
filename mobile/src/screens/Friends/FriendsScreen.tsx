import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FriendsStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import ProfilePhoto from '../../components/ProfilePhoto';
import { getPhotoUrl } from '../../utils/photoUrl';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<FriendsStackParamList, 'FriendsList'>;

// Avatar listesi
// Avatar listesi - merkezi dosyadan import
import { AVATARS, getAvatar } from '../../constants/avatars';

interface LastMessage {
  content?: string | null;
  mediaType?: string | null;
  senderId: string;
  createdAt: string;
}

interface Friend {
  friendshipId: string;
  id: string;
  nickname: string;
  avatarId?: number;
  profilePhoto?: string;
  isOnline: boolean;
  isPrime?: boolean;
  lastSeenAt?: string;
  unreadCount: number;
  lastMessage?: LastMessage | null;
  hasIncomingCall?: boolean;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  nickname: string;
  avatarId?: number;
  profilePhoto?: string;
  isPrime?: boolean;
  createdAt: string;
}

const FriendsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [friendAlertVisible, setFriendAlertVisible] = useState(false);
  const [friendAlertType, setFriendAlertType] = useState<'success' | 'error' | 'reject'>('success');
  const [friendAlertMessage, setFriendAlertMessage] = useState('');

  const loadFriends = async () => {
    try {
      const res = await api.get<{ success: boolean; data: Friend[] }>(
        '/api/user/friends',
      );
      // Mükerrer engelleme - friendshipId'ye göre unique yap
      const uniqueFriends = res.data.data.filter(
        (friend, index, self) => 
          index === self.findIndex((f) => f.friendshipId === friend.friendshipId)
      );
      setFriends(uniqueFriends);
    } catch {
      // TODO toast
    }
  };

  const loadRequests = async () => {
    try {
      const res = await api.get<{ success: boolean; data: FriendRequest[] }>(
        '/api/user/friend-requests',
      );
      // Mükerrer engelleme - id'ye göre unique yap
      const uniqueRequests = res.data.data.filter(
        (req, index, self) => 
          index === self.findIndex((r) => r.id === req.id)
      );
      setRequests(uniqueRequests);
    } catch {
      // TODO toast
    }
  };

  // Ekran her odaklandığında yenile
  useFocusEffect(
    useCallback(() => {
      loadFriends();
      loadRequests();
    }, [])
  );

  // Socket dinleyicileri
  useEffect(() => {
    const socket = getSocket();
    
    // Yeni arkadaşlık isteği geldiğinde
    const handleRequestReceived = (data: { requestId: string; fromUserId: string; toUserId: string }) => {
      console.log('[FriendsScreen] friend:request:received', data);
      if (data.toUserId === user?.id) {
        loadRequests();
      }
    };

    // Arkadaşlık kabul edildiğinde
    const handleFriendAccepted = (data: { friendshipId: string; user1Id: string; user2Id: string }) => {
      console.log('[FriendsScreen] friend:accepted', data);
      if (data.user1Id === user?.id || data.user2Id === user?.id) {
        loadFriends();
        loadRequests();
      }
    };

    // Arkadaşlık reddedildiğinde
    const handleFriendRejected = (data: { requestId: string }) => {
      console.log('[FriendsScreen] friend:rejected', data);
      loadRequests();
    };

    // Yeni mesaj geldiğinde - listeyi güncelle (chat room'undayken)
    const handleNewMessage = (data: { friendChatId: string; senderId: string }) => {
      console.log('[FriendsScreen] friend:message (via ROOM)', JSON.stringify(data));
      if (data.senderId !== user?.id) {
        loadFriends(); // Okunmamış sayısını güncellemek için
      }
    };
    
    // 🔔 Bildirim geldiğinde - listeyi güncelle (userId room'a gelir)
    const handleFriendNotification = (data: { 
      type: string; 
      friendshipId: string; 
      senderId: string; 
      senderNickname: string;
      preview: string;
    }) => {
      console.log('[FriendsScreen] friend:notification (via USER ID)', JSON.stringify(data));
      // Listeyi yenile (unread count güncellenir)
      loadFriends();
      
      // Alternatif: Sadece ilgili arkadaşın unread count'unu artır (daha hızlı)
      setFriends(prev => prev.map(friend => 
        friend.friendshipId === data.friendshipId
          ? { 
              ...friend, 
              unreadCount: (friend.unreadCount || 0) + 1,
              lastMessage: {
                content: data.preview,
                senderId: data.senderId,
                createdAt: new Date().toISOString(),
              }
            }
          : friend
      ));
    };

    // 🟢 Kullanıcı online/offline durumu değiştiğinde
    const handleUserStatus = (data: { userId: string; isOnline: boolean; lastSeenAt?: string }) => {
      console.log('[FriendsScreen] user:status', data);
      setFriends(prev => prev.map(friend => 
        friend.id === data.userId
          ? { 
              ...friend, 
              isOnline: data.isOnline,
              lastSeenAt: data.lastSeenAt || friend.lastSeenAt,
            }
          : friend
      ));
    };

    socket.on('friend:request:received', handleRequestReceived);
    socket.on('friend:accepted', handleFriendAccepted);
    socket.on('friend:rejected', handleFriendRejected);
    socket.on('friend:message', handleNewMessage);
    socket.on('friend:notification', handleFriendNotification);
    socket.on('user:status', handleUserStatus);

    return () => {
      socket.off('friend:request:received', handleRequestReceived);
      socket.off('friend:accepted', handleFriendAccepted);
      socket.off('friend:rejected', handleFriendRejected);
      socket.off('friend:message', handleNewMessage);
      socket.off('friend:notification', handleFriendNotification);
      socket.off('user:status', handleUserStatus);
    };
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFriends(), loadRequests()]);
    setRefreshing(false);
  };

  const handleRespondRequest = async (requestId: string, accept: boolean) => {
    try {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      await api.post(`/api/user/friend-requests/${requestId}/respond`, { accept });
      setFriendAlertType(accept ? 'success' : 'reject');
      setFriendAlertMessage(accept ? 'Arkadaşlık isteği kabul edildi.' : 'Arkadaşlık isteği reddedildi.');
      setFriendAlertVisible(true);
      if (accept) {
        loadFriends();
      }
    } catch {
      loadRequests();
      setFriendAlertType('error');
      setFriendAlertMessage('İşlem gerçekleştirilemedi.');
      setFriendAlertVisible(true);
    }
  };

  const handleRemoveFriend = async (friendshipId: string, nickname: string, friendId: string) => {
    Alert.alert(
      'Arkadaş Seçenekleri',
      `${nickname} için ne yapmak istiyorsun?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Arkadaşlıktan Çıkar',
          onPress: async () => {
            try {
              await api.delete(`/api/user/friends/${friendshipId}`);
              setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
              setFriendAlertType('success');
              setFriendAlertMessage('Arkadaşlıktan çıkarıldı.');
              setFriendAlertVisible(true);
            } catch {
              Alert.alert('Hata', 'Arkadaşlıktan çıkarılamadı.');
            }
          },
        },
        {
          text: 'Engelle',
          style: 'destructive',
          onPress: async () => {
            try {
              // Önce arkadaşlıktan çıkar
              await api.delete(`/api/user/friends/${friendshipId}`);
              // Sonra engelle
              await api.post('/api/user/block', { blockedId: friendId });
              setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
              setFriendAlertType('success');
              setFriendAlertMessage('Kullanıcı engellendi. Artık size ulaşamaz.');
              setFriendAlertVisible(true);
            } catch {
              Alert.alert('Hata', 'Engelleme işlemi başarısız.');
            }
          },
        },
      ],
    );
  };

  // getAvatar artık merkezi dosyadan import ediliyor

  // Son mesaj önizlemesi
  const getLastMessagePreview = (lastMessage?: LastMessage | null) => {
    if (!lastMessage) return null;
    
    if (lastMessage.mediaType === 'audio') {
      return '🎤 Ses mesajı';
    } else if (lastMessage.mediaType === 'photo') {
      return '📷 Fotoğraf';
    } else if (lastMessage.mediaType === 'video') {
      return '🎥 Video';
    } else if (lastMessage.content) {
      return lastMessage.content.length > 30 
        ? lastMessage.content.substring(0, 30) + '...'
        : lastMessage.content;
    }
    return null;
  };

  // Toplam okunmamış mesaj sayısı
  const totalUnreadCount = friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

  const renderFriend = ({ item }: { item: Friend }) => {
    const avatar = getAvatar(item.avatarId);
    const lastMessagePreview = getLastMessagePreview(item.lastMessage);
    
    return (
      <TouchableOpacity
        style={styles.friendRow}
        onPress={() =>
          navigation.navigate('FriendChat', {
            friendshipId: item.friendshipId,
            friendNickname: item.nickname,
            friendPhoto: item.profilePhoto ? getPhotoUrl(item.profilePhoto) : undefined,
            friendAvatarId: item.avatarId,
            friendOnline: item.isOnline,
            friendId: item.id,
          })
        }
        onLongPress={() => handleRemoveFriend(item.friendshipId, item.nickname, item.id)}
      >
        <View style={styles.avatarWrapper}>
          {item.profilePhoto ? (
            <ProfilePhoto
              uri={getPhotoUrl(item.profilePhoto)}
              size={50}
              online={item.isOnline}
            />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: avatar.color }]}>
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
              {item.isOnline && <View style={styles.onlineIndicator} />}
            </View>
          )}
          {/* Okunmamış mesaj badge'i */}
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.friendInfo}>
          <View style={styles.nicknameRow}>
            <Text style={FONTS.body}>{item.nickname}</Text>
            {item.isPrime && <Text style={styles.primeBadge}>👑</Text>}
          </View>
          {lastMessagePreview && (
            <Text 
              style={[
                styles.lastMessage, 
                item.unreadCount > 0 && styles.lastMessageUnread
              ]} 
              numberOfLines={1}
            >
              {lastMessagePreview}
            </Text>
          )}
        </View>

        {/* Sağ taraf - online durumu veya bildirim ikonu */}
        <View style={styles.rightSection}>
          {item.isOnline ? (
            <Text style={styles.onlineText}>Çevrimiçi</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderRequest = ({ item }: { item: FriendRequest }) => {
    const avatar = getAvatar(item.avatarId);
    return (
      <View style={styles.requestRow}>
        {item.profilePhoto ? (
          <ProfilePhoto uri={getPhotoUrl(item.profilePhoto)} size={50} />
        ) : (
          <View style={[styles.avatarCircle, { backgroundColor: avatar.color }]}>
            <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
          </View>
        )}
        <View style={styles.requestInfo}>
          <View style={styles.nicknameRow}>
            <Text style={FONTS.body}>{item.nickname}</Text>
            {item.isPrime && <Text style={styles.primeBadge}>👑</Text>}
          </View>
          <Text style={FONTS.caption}>Arkadaşlık isteği gönderdi</Text>
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleRespondRequest(item.id, true)}
          >
            <Text style={styles.acceptText}>✓</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRespondRequest(item.id, false)}
          >
            <Text style={styles.rejectText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => setActiveTab('friends')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'friends' && styles.activeTabText,
            ]}
          >
            Arkadaşlar ({friends.length})
          </Text>
          {totalUnreadCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'requests' && styles.activeTabText,
            ]}
          >
            İstekler ({requests.length})
          </Text>
          {requests.length > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'friends' ? (
        friends.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={FONTS.h3}>Henüz arkadaşınız yok 😔</Text>
            <Text style={[FONTS.caption, styles.emptySubtext]}>
              Sohbetlerde arkadaşlık isteği gönderin
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.friendshipId}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={renderFriend}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={FONTS.h3}>Bekleyen istek yok</Text>
          <Text style={[FONTS.caption, styles.emptySubtext]}>
            Arkadaşlık istekleri burada görünecek
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={renderRequest}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}

      {/* Arkadaşlık İsteği Alert Modal */}
      <Modal
        visible={friendAlertVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFriendAlertVisible(false)}
      >
        <View style={styles.friendAlertOverlay}>
          <View style={styles.friendAlertContent}>
            <View style={[
              styles.friendAlertIconWrapper,
              friendAlertType === 'success' && styles.friendAlertIconSuccess,
              friendAlertType === 'reject' && styles.friendAlertIconReject,
              friendAlertType === 'error' && styles.friendAlertIconError,
            ]}>
              <Ionicons 
                name={
                  friendAlertType === 'success' ? 'checkmark-circle' :
                  friendAlertType === 'reject' ? 'close-circle' : 'alert-circle'
                } 
                size={40} 
                color="#fff" 
              />
            </View>
            <Text style={styles.friendAlertTitle}>
              {friendAlertType === 'success' ? 'Kabul Edildi' :
               friendAlertType === 'reject' ? 'Reddedildi' : 'Hata'}
            </Text>
            <Text style={styles.friendAlertMessage}>{friendAlertMessage}</Text>
            <TouchableOpacity 
              style={[
                styles.friendAlertButton,
                friendAlertType === 'success' && styles.friendAlertButtonSuccess,
                friendAlertType === 'reject' && styles.friendAlertButtonReject,
                friendAlertType === 'error' && styles.friendAlertButtonError,
              ]}
              onPress={() => setFriendAlertVisible(false)}
            >
              <Text style={styles.friendAlertButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  activeTabText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
  },
  tabBadge: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  avatarWrapper: {
    position: 'relative',
  },
  friendInfo: {
    flex: 1,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  primeBadge: {
    fontSize: 12,
  },
  lastMessage: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  lastMessageUnread: {
    color: COLORS.text,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  onlineText: {
    ...FONTS.caption,
    color: '#00B894',
    fontSize: 11,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00B894',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  requestInfo: {
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  rejectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Arkadaşlık İsteği Alert Modal
  friendAlertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  friendAlertContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '90%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(125, 212, 212, 0.2)',
  },
  friendAlertIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  friendAlertIconSuccess: {
    backgroundColor: COLORS.success,
  },
  friendAlertIconReject: {
    backgroundColor: COLORS.warning,
  },
  friendAlertIconError: {
    backgroundColor: COLORS.error,
  },
  friendAlertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  friendAlertMessage: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  friendAlertButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  friendAlertButtonSuccess: {
    backgroundColor: COLORS.success,
  },
  friendAlertButtonReject: {
    backgroundColor: COLORS.warning,
  },
  friendAlertButtonError: {
    backgroundColor: COLORS.error,
  },
  friendAlertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default FriendsScreen;
