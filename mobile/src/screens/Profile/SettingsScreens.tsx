import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ProfileStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

// ============ KULLANICI ADI DEĞİŞTİR ============
type ChangeNicknameProps = NativeStackScreenProps<ProfileStackParamList, 'ChangeNickname'>;

export const ChangeNicknameScreen: React.FC<ChangeNicknameProps> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Türkçe karakter kontrolü
  const hasTurkishChars = (text: string) => {
    return /[çğıöşüÇĞİÖŞÜ]/.test(text);
  };

  // Kullanıcı adı uygunluk kontrolü
  const checkAvailability = async (name: string) => {
    if (name.length < 3) {
      setIsAvailable(null);
      setErrorMessage('En az 3 karakter gerekli');
      return;
    }
    
    if (hasTurkishChars(name)) {
      setIsAvailable(false);
      setErrorMessage('Türkçe karakter kullanılamaz');
      return;
    }
    
    if (name === user?.nickname) {
      setIsAvailable(null);
      setErrorMessage('Bu zaten mevcut kullanıcı adın');
      return;
    }
    
    try {
      setChecking(true);
      setErrorMessage(null);
      const res = await api.get(`/api/user/check-nickname?nickname=${encodeURIComponent(name)}`);
      setIsAvailable(res.data.available);
      if (!res.data.available) {
        setErrorMessage('Bu kullanıcı adı zaten alınmış');
      }
    } catch {
      setIsAvailable(null);
      setErrorMessage('Kontrol edilemedi');
    } finally {
      setChecking(false);
    }
  };

  // Debounce ile kontrol
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (nickname.length >= 3) {
        checkAvailability(nickname);
      } else {
        setIsAvailable(null);
        setErrorMessage(nickname.length > 0 ? 'En az 3 karakter gerekli' : null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname]);

  const handleSave = async () => {
    if (nickname.length < 3) {
      Alert.alert('Hata', 'Kullanıcı adı en az 3 karakter olmalı.');
      return;
    }
    
    if (hasTurkishChars(nickname)) {
      Alert.alert('Hata', 'Türkçe karakter kullanılamaz.');
      return;
    }
    
    if (isAvailable === false) {
      Alert.alert('Hata', 'Bu kullanıcı adı zaten alınmış.');
      return;
    }
    
    try {
      setLoading(true);
      await api.put('/api/user/me', { nickname });
      await refreshProfile();
      Alert.alert('Başarılı', 'Kullanıcı adın güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 
                      (error.message === 'Network Error' ? 'İnternet bağlantısı yok' : 'Güncelleme başarısız.');
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kullanıcı Adını Değiştir</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>Yeni Kullanıcı Adı</Text>
        <View style={styles.inputWithStatus}>
          <TextInput
            style={[
              styles.input, 
              styles.inputFlex,
              isAvailable === true && styles.inputSuccess,
              isAvailable === false && styles.inputError,
            ]}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Kullanıcı adı"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            maxLength={20}
          />
          {checking && (
            <View style={styles.statusIcon}>
              <Text style={styles.checkingText}>...</Text>
            </View>
          )}
          {!checking && isAvailable === true && (
            <View style={styles.statusIcon}>
              <Ionicons name="checkmark-circle" size={24} color="#00B894" />
            </View>
          )}
          {!checking && isAvailable === false && (
            <View style={styles.statusIcon}>
              <Ionicons name="close-circle" size={24} color={COLORS.danger} />
            </View>
          )}
        </View>
        
        {errorMessage ? (
          <Text style={[styles.hint, styles.hintError]}>{errorMessage}</Text>
        ) : isAvailable === true ? (
          <Text style={[styles.hint, styles.hintSuccess]}>Bu kullanıcı adı müsait ✓</Text>
        ) : (
          <Text style={styles.hint}>3-20 karakter, türkçe karakter kullanılamaz</Text>
        )}
        
        <TouchableOpacity 
          style={[
            styles.saveButton, 
            (loading || isAvailable !== true) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={loading || isAvailable !== true}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============ E-POSTA DEĞİŞTİR ============
type ChangeEmailProps = NativeStackScreenProps<ProfileStackParamList, 'ChangeEmail'>;

export const ChangeEmailScreen: React.FC<ChangeEmailProps> = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [loading, setLoading] = useState(false);
  const [testCode, setTestCode] = useState<string | null>(null);

  const handleRequestCode = async () => {
    if (!email.includes('@')) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }
    
    try {
      setLoading(true);
      const res = await api.post('/api/user/me/email/request-change', { newEmail: email });
      
      // Development'ta test kodu göster
      if (res.data.testCode) {
        setTestCode(res.data.testCode);
      }
      
      setStep('verify');
      Alert.alert('Başarılı', 'Doğrulama kodu e-posta adresine gönderildi.');
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.error?.message || 'İstek başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Hata', '6 haneli doğrulama kodunu girin.');
      return;
    }
    
    try {
      setLoading(true);
      await api.post('/api/user/me/email/verify', { code: verificationCode });
      await refreshProfile();
      Alert.alert('Başarılı', 'E-posta adresin güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      let message = 'Doğrulama başarısız.';
      if (!error.response && error.message === 'Network Error') {
        message = 'İnternet bağlantısı yok.';
      } else if (error.response?.data?.error?.message) {
        message = error.response.data.error.message;
      }
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 'verify' ? setStep('email') : navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-posta Değiştir</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        {step === 'email' ? (
          <>
            <Text style={styles.label}>Mevcut E-posta</Text>
            <View style={styles.currentEmailContainer}>
              <Text style={styles.currentEmailText}>{user?.email || 'Belirtilmemiş'}</Text>
            </View>
            
            <Text style={styles.label}>Yeni E-posta Adresi</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="yeni@mail.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>Yeni e-posta adresine doğrulama kodu gönderilecek.</Text>
            
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleRequestCode}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>{loading ? 'Gönderiliyor...' : 'Doğrulama Kodu Gönder'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.verifyHeader}>
              <Ionicons name="mail-outline" size={48} color={COLORS.primary} />
              <Text style={styles.verifyTitle}>Doğrulama Kodu</Text>
              <Text style={styles.verifySubtitle}>{email} adresine gönderilen 6 haneli kodu gir</Text>
            </View>
            
            {testCode && (
              <View style={styles.testCodeBanner}>
                <Text style={styles.testCodeText}>Test Kodu: {testCode}</Text>
              </View>
            )}
            
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="000000"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
            
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>{loading ? 'Doğrulanıyor...' : 'E-postayı Doğrula'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.resendButton} onPress={handleRequestCode} disabled={loading}>
              <Text style={styles.resendButtonText}>Kodu Tekrar Gönder</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

// ============ ŞİFRE DEĞİŞTİR ============
type ChangePasswordProps = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

export const ChangePasswordScreen: React.FC<ChangePasswordProps> = ({ navigation }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    
    try {
      setLoading(true);
      await api.put('/api/user/me/password', { currentPassword, newPassword });
      Alert.alert('Başarılı', 'Şifren güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      let message = 'Şifre güncellenemedi.';
      if (!error.response && error.message === 'Network Error') {
        message = 'İnternet bağlantısı yok.';
      } else if (error.response?.data?.error?.message) {
        message = error.response.data.error.message;
      }
      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Şifre Değiştir</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>Mevcut Şifre</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="••••••"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
        />
        
        <Text style={styles.label}>Yeni Şifre</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="••••••"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
        />
        
        <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="••••••"
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry
        />
        
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============ ENGELLİ KULLANICILAR ============
type BlockedUsersProps = NativeStackScreenProps<ProfileStackParamList, 'BlockedUsers'>;

export const BlockedUsersScreen: React.FC<BlockedUsersProps> = ({ navigation }) => {
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const res = await api.get('/api/user/blocked');
      setBlockedUsers(res.data.data || []);
    } catch {
      // Hata gösterme
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId: string) => {
    Alert.alert(
      'Engeli Kaldır',
      'Bu kullanıcının engelini kaldırmak istiyor musun?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Engeli Kaldır',
          onPress: async () => {
            try {
              await api.delete(`/api/user/block/${userId}`);
              setBlockedUsers(prev => prev.filter(u => u.id !== userId));
            } catch {
              Alert.alert('Hata', 'Engel kaldırılamadı.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Engellenen Kullanıcılar</Text>
        <View style={{ width: 24 }} />
      </View>
      
      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ban-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Engellenen kullanıcı yok</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <Text style={styles.userName}>{item.nickname}</Text>
              <TouchableOpacity 
                style={styles.unblockButton}
                onPress={() => handleUnblock(item.id)}
              >
                <Text style={styles.unblockButtonText}>Engeli Kaldır</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

// ============ KONUŞMALARI SİL ============
type DeleteConversationsProps = NativeStackScreenProps<ProfileStackParamList, 'DeleteConversations'>;

export const DeleteConversationsScreen: React.FC<DeleteConversationsProps> = ({ navigation }) => {
  const handleDeleteAll = () => {
    Alert.alert(
      'Tüm Konuşmaları Sil',
      'Tüm sohbet geçmişin kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tümünü Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/api/user/conversations');
              Alert.alert('Başarılı', 'Tüm konuşmalar silindi.', [
                { text: 'Tamam', onPress: () => navigation.goBack() }
              ]);
            } catch {
              Alert.alert('Hata', 'Konuşmalar silinemedi.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Konuşmaları Sil</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={32} color={COLORS.danger} />
          <Text style={styles.warningTitle}>Dikkat!</Text>
          <Text style={styles.warningText}>
            Tüm mesajların ve sohbet geçmişin kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </Text>
        </View>
        
        <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAll}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.dangerButtonText}>Tüm Konuşmaları Sil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============ UYGULAMA KİLİDİ ============
type AppLockProps = NativeStackScreenProps<ProfileStackParamList, 'AppLock'>;

export const AppLockScreen: React.FC<AppLockProps> = ({ navigation }) => {
  const [isEnabled, setIsEnabled] = useState(false);

  const toggleSwitch = () => {
    Alert.alert(
      'Yakında',
      'Bu özellik yakında aktif olacak. Face ID / Touch ID desteği ile uygulamanızı koruyabileceksiniz.',
      [{ text: 'Tamam' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Uygulama Kilidi</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Icon Header */}
        <View style={styles.appLockHeader}>
          <View style={styles.appLockIconWrapper}>
            <Ionicons name="finger-print" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.appLockTitle}>Biyometrik Kilit</Text>
          <Text style={styles.appLockSubtitle}>
            Uygulamanı Face ID veya Touch ID ile koru
          </Text>
        </View>
        
        {/* Toggle Card */}
        <View style={styles.appLockCard}>
          <View style={styles.appLockCardContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.textMuted} />
            <Text style={styles.appLockCardText}>Kilidi Etkinleştir</Text>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={toggleSwitch}
            trackColor={{ false: COLORS.surface, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>
        
        {/* Info */}
        <View style={styles.appLockInfoCard}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
          <Text style={styles.appLockInfoText}>
            Kilit aktif olduğunda, uygulamayı her açışınızda biyometrik doğrulama yapmanız gerekecektir.
          </Text>
        </View>
        
        {/* Coming Soon Badge */}
        <View style={styles.comingSoonBadge}>
          <Ionicons name="time-outline" size={16} color={COLORS.accent} />
          <Text style={styles.comingSoonText}>Bu özellik yakında aktif olacak</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============ YARDIM ============
type HelpProps = NativeStackScreenProps<ProfileStackParamList, 'Help'>;

export const HelpScreen: React.FC<HelpProps> = ({ navigation }) => {
  const faqs = [
    { q: 'Spark nedir?', a: 'Spark, gönderdiğin fotoğraf veya video birisi tarafından açıldığında kazandığın puandır. Aylık liderlik tablosunda sıralamaya girer.' },
    { q: 'Elmas nedir?', a: 'Elmas, fotoğraf, video ve ses kayıtlarını açmak için kullanılan sanal paradır. Uygulama içinden satın alabilirsin.' },
    { q: 'Nasıl eşleşirim?', a: 'Ana sayfadan "Eşleşme Bul" butonuna bas. Sistem sana uygun birini bulduğunda kart oyunu başlar ve ardından sohbet açılır.' },
    { q: 'Arkadaş nasıl eklerim?', a: 'Eşleştiğin kişiyle sohbet ederken "Arkadaş Ekle" butonuna basarak arkadaşlık isteği gönderebilirsin.' },
    { q: 'Medya neden kayboluyor?', a: 'Gizliliğin için fotoğraf, video ve ses kayıtları bir kez görüntülendikten sonra otomatik silinir.' },
    { q: 'Hesabımı nasıl silerim?', a: 'Profil > Hesabımı Dondur seçeneğini kullanabilirsin. Hesabın dondurulur ve 30 gün içinde tekrar giriş yapmazsan veriler silinir.' },
    { q: 'Engellediğim kullanıcılar ne olur?', a: 'Engellediğin kullanıcılar seni göremez, seninle eşleşemez ve mesaj gönderemez.' },
    { q: 'Günlük ödül nasıl çalışır?', a: 'Her gün uygulamaya giriş yaparak elmas kazanabilirsin. 7 günlük seri tamamladığında bonus alırsın!' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Yardım</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Sık Sorulan Sorular</Text>
        {faqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{faq.q}</Text>
            <Text style={styles.faqAnswer}>{faq.a}</Text>
          </View>
        ))}
        
        <View style={styles.contactSection}>
          <Text style={styles.sectionHeader}>İletişim</Text>
          <View style={styles.contactCard}>
            <Ionicons name="mail-outline" size={24} color={COLORS.primary} />
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>E-posta Desteği</Text>
              <Text style={styles.contactValue}>destek@cardmatchapp.com</Text>
            </View>
          </View>
          <Text style={styles.contactHint}>
            Sorularınız için bize e-posta gönderin, en kısa sürede yanıtlayalım.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============ GÖRİŞ / ÖNERİ GÖNDER ============
type FeedbackProps = NativeStackScreenProps<ProfileStackParamList, 'Feedback'>;

export const FeedbackScreen: React.FC<FeedbackProps> = ({ navigation }) => {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (feedback.length < 10) {
      Alert.alert('Hata', 'Lütfen en az 10 karakter girin.');
      return;
    }
    
    try {
      setLoading(true);
      await api.post('/api/user/feedback', { message: feedback });
      Alert.alert('Teşekkürler!', 'Görüşün bize ulaştı. En kısa sürede değerlendireceğiz.', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch {
      Alert.alert('Hata', 'Gönderim başarısız. Lütfen tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Görüş / Öneri</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>Mesajın</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={feedback}
          onChangeText={setFeedback}
          placeholder="Görüş, öneri veya şikayetini yaz..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{feedback.length}/500</Text>
        
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          <Ionicons name="send-outline" size={20} color={COLORS.text} />
          <Text style={styles.saveButtonText}>{loading ? 'Gönderiliyor...' : 'Gönder'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ============ STYLES ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  content: {
    padding: SPACING.lg,
  },
  label: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textarea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  hint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  hintError: {
    color: COLORS.danger,
  },
  hintSuccess: {
    color: '#00B894',
  },
  inputWithStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
  },
  inputSuccess: {
    borderColor: '#00B894',
    borderWidth: 1,
  },
  inputError: {
    borderColor: COLORS.danger,
    borderWidth: 1,
  },
  statusIcon: {
    marginLeft: SPACING.sm,
    width: 30,
    alignItems: 'center',
  },
  checkingText: {
    color: COLORS.textMuted,
    fontSize: 18,
  },
  charCount: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...FONTS.button,
    color: COLORS.text,
    fontWeight: '600',
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userName: {
    ...FONTS.body,
    color: COLORS.text,
  },
  unblockButton: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  unblockButtonText: {
    ...FONTS.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Warning
  warningCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger + '30',
  },
  warningTitle: {
    ...FONTS.h3,
    color: COLORS.danger,
    marginTop: SPACING.sm,
  },
  warningText: {
    ...FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  dangerButtonText: {
    ...FONTS.button,
    color: '#fff',
    fontWeight: '600',
  },
  // Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '500',
  },
  settingSubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  infoText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  // AppLock Screen
  appLockHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  appLockIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  appLockTitle: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  appLockSubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  appLockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  appLockCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  appLockCardText: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '500',
  },
  appLockInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  appLockInfoText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  comingSoonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  comingSoonText: {
    ...FONTS.caption,
    color: COLORS.accent,
    fontWeight: '600',
  },
  // Help
  sectionHeader: {
    ...FONTS.h3,
    color: COLORS.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  faqItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  faqQuestion: {
    ...FONTS.body,
    color: COLORS.text,
    fontWeight: '600',
  },
  faqAnswer: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  contactSection: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  contactText: {
    ...FONTS.body,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
  contactValue: {
    ...FONTS.body,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  contactHint: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Email Verification
  currentEmailContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  currentEmailText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
  verifyHeader: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  verifyTitle: {
    ...FONTS.h2,
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  verifySubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  codeInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
  },
  testCodeBanner: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  testCodeText: {
    ...FONTS.caption,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resendButtonText: {
    ...FONTS.caption,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
