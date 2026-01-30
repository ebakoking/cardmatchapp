import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<ChatStackParamList, 'MatchQueue'>;

const MatchQueueScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [searching, setSearching] = useState(true);
  
  // Track if match was found - don't emit match:leave on successful match
  const matchFoundRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!user) return;

    console.log('[MatchQueue] Joining queue with userId:', user.id);
    socket.emit('match:join', { userId: user.id });

    socket.on('match:found', (payload: { matchId: string; partnerNickname: string }) => {
      console.log('[MatchQueue] Match found:', payload);
      matchFoundRef.current = true; // Mark that match was found
      setSearching(false);
      navigation.replace('CardGate', { matchId: payload.matchId });
    });

    socket.on('match:blocked', (data: { reason: string; message: string }) => {
      console.log('[MatchQueue] Match blocked:', data);
      setSearching(false);
      
      // Kullanıcıya hata mesajı göster
      let title = 'Eşleşme Engellendi';
      let message = data?.message || 'Şu anda eşleşme yapamazsınız.';
      
      if (data?.reason === 'DAILY_LIMIT') {
        title = 'Günlük Limit';
        message = 'Günlük sohbet limitinizi doldurdunuz. Prime üye olarak sınırsız sohbet başlatabilirsiniz!';
      } else if (data?.reason === 'UNVERIFIED') {
        title = 'Doğrulama Gerekli';
        message = 'Profiliniz henüz onaylanmadı. Lütfen bekleyin.';
      }
      
      Alert.alert(title, message, [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    });

    // match:ended event (eşleşme sırasında peer ayrılırsa)
    socket.on('match:ended', (payload: { reason: string; message?: string }) => {
      console.log('[MatchQueue] match:ended received:', payload);
      // Arama ekranında isek sadece log, kullanıcı zaten aranıyor durumunda
    });

    return () => {
      // Cleanup: kuyruktan çık - AMA match bulunduysa çıkma!
      // match:leave oyunu siler, bu yüzden match bulunduysa emit etmemeliyiz
      if (!matchFoundRef.current) {
        console.log('[MatchQueue] Leaving queue for userId:', user.id);
        socket.emit('match:leave', { userId: user.id });
      } else {
        console.log('[MatchQueue] Match found, NOT emitting match:leave');
      }
      socket.off('match:found');
      socket.off('match:blocked');
      socket.off('match:ended');
    };
  }, [navigation, user]);

  const cancel = () => {
    const socket = getSocket();
    if (user) {
      console.log('[MatchQueue] User cancelled, leaving queue:', user.id);
      socket.emit('match:leave', { userId: user.id });
    }
    setSearching(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={FONTS.h2}>ARANIYOR...</Text>
      <ActivityIndicator
        style={{ marginTop: SPACING.lg }}
        size="large"
        color={COLORS.primary}
      />
      <TouchableOpacity style={styles.button} onPress={cancel}>
        <Text style={FONTS.button}>İptal Et</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
});

export default MatchQueueScreen;

