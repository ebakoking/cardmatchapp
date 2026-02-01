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
import { Ionicons } from '@expo/vector-icons';
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
      await api.put('/api/user/me', {
        bio: bio || null,
      });
      navigation.replace('Tutorial');
    } catch (error) {
      console.error('Bio save error:', error);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={goBack}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            <Text style={styles.title}>Kendini Anlat</Text>
            <Text style={styles.subtitle}>
              Kısa bir bio yaz, seni merak edenler okusun
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

            {/* Trust Microcopy */}
            <View style={styles.trustInfo}>
              <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.trustText}>
                Bu bilgiler yalnızca karşılıklı eşleşip arkadaş olduğunuzda görünür.
              </Text>
            </View>
          </View>
        </TouchableWithoutFeedback>

        <View style={styles.footer}>
          {/* Confidence microcopy */}
          <Text style={styles.confidenceText}>
            Profilinden dilediğin zaman düzenleyebilirsin.
          </Text>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={saveBio}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Kaydediliyor...' : 'Devam Et'}
            </Text>
          </TouchableOpacity>

          {/* Secondary link */}
          {bio.length === 0 && (
            <TouchableOpacity style={styles.skipLink} onPress={saveBio}>
              <Text style={styles.skipLinkText}>Şimdilik boş bırak</Text>
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
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: SPACING.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    padding: SPACING.xl,
  },
  content: {
    flex: 1,
    paddingTop: SPACING.xxl,
  },
  title: {
    ...FONTS.h2,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    fontSize: 14,
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
  trustInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  trustText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    flex: 1,
    fontSize: 12,
  },
  footer: {
    paddingBottom: SPACING.lg,
  },
  confidenceText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
    fontSize: 13,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...FONTS.button,
    color: COLORS.background,
    fontSize: 16,
  },
  skipLink: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipLinkText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default BioInputScreen;
