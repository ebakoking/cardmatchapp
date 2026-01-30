import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'BioInput'>;

const BioInputScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [bio, setBio] = useState(user?.bio ?? '');
  const [loading, setLoading] = useState(false);

  const saveBio = async () => {
    try {
      setLoading(true);
      // SADECE bio alanını gönder - diğer alanları gönderme!
      // Aksi halde AuthContext'teki eski veriler doğru kaydedilmiş değerleri ezer.
      await api.put('/api/user/me', {
        bio: bio || null,
      });
      // ÖNEMLİ: refreshProfile() ÇAĞIRMA! 
      // Navigator'ın MainTabs'e erken geçmesini önlemek için profil Tutorial'da güncellenecek.
      navigation.replace('Tutorial');
    } catch (error) {
      console.error('Bio save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const skipBio = () => {
    navigation.replace('Tutorial');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <Text style={styles.emoji}>✍️</Text>
            <Text style={styles.title}>Kendini Anlat</Text>
            <Text style={styles.subtitle}>
              Kısa bir bio yaz, diğerleri seni tanısın
            </Text>

            <TextInput
              style={styles.textarea}
              value={bio}
              onChangeText={(text) => text.length <= 150 && setBio(text)}
              multiline
              numberOfLines={4}
              placeholder="Birkaç kelimeyle kendinden bahset..."
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.counter}>{bio.length}/150</Text>
          </View>
        </TouchableWithoutFeedback>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.button}
            disabled={loading}
            onPress={saveBio}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Kaydediliyor...' : bio.length > 0 ? 'Devam Et' : 'Boş Bırak ve Devam Et'}
            </Text>
          </TouchableOpacity>

          {bio.length > 0 && (
            <TouchableOpacity style={styles.skipButton} onPress={skipBio}>
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
    padding: SPACING.xl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  emoji: {
    fontSize: 50,
    marginBottom: SPACING.md,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
  },
  subtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xl,
  },
  textarea: {
    width: '100%',
    borderRadius: 16,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    minHeight: 140,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  counter: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
  },
  footer: {
    paddingBottom: SPACING.lg,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 16,
  },
  skipButton: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  skipText: {
    ...FONTS.body,
    color: COLORS.textMuted,
  },
});

export default BioInputScreen;
