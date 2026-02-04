/**
 * Yeni eşleşme sistemi v2: 5 soru cevapla → kuyruk → algoritma eşleştirir.
 * "En az X ortak cevap" (1-5) + 5 soru + 60 sn timer → submit → MatchQueue (bekle) → match:found → Chat.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ChatStackParamList } from '../../navigation';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';

type Props = NativeStackScreenProps<ChatStackParamList, 'MatchQuestions'>;

interface QuestionOption {
  id: string;
  optionText: string;
  orderIndex: number;
}

interface Question {
  id: string;
  questionText: string;
  orderIndex: number;
  options: QuestionOption[];
}

const TIMER_SECONDS = 60;

const MatchQuestionsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [minCommon, setMinCommon] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timer, setTimer] = useState(TIMER_SECONDS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ success: boolean; questions: Question[] }>('/match/questions');
        const data = (res as any)?.data ?? res;
        if (data?.success && data.questions?.length === 5 && !cancelled) {
          setQuestions(data.questions);
        } else {
          Alert.alert('Hata', 'Sorular yüklenemedi.');
          navigation.goBack();
        }
      } catch (e) {
        if (!cancelled) {
          Alert.alert('Hata', 'Sorular yüklenemedi. İnternet bağlantınızı kontrol edin.');
          navigation.goBack();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigation]);

  useEffect(() => {
    if (questions.length === 0 || submitting) return;
    const t = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [questions.length, submitting]);

  const handleSelect = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const canSubmit = questions.length === 5 && Object.keys(answers).length === 5;

  const handleSubmit = useCallback(() => {
    if (!user || !canSubmit || submitting) return;
    const answersArr = questions.map((q) => ({
      questionId: q.id,
      optionId: answers[q.id],
    }));
    if (answersArr.some((a) => !a.optionId)) return;
    setSubmitting(true);
    const socket = getSocket();
    socket.emit('match:submit_answers', {
      userId: user.id,
      answers: answersArr,
      minimumCommonAnswers: minCommon,
    });
    socket.once('match:searching', () => {
      navigation.replace('MatchQueue', { fromV2: true });
    });
    socket.once('match:error', (data: { code?: string; message?: string }) => {
      setSubmitting(false);
      Alert.alert('Hata', data?.message || 'Gönderilemedi.');
    });
  }, [user, canSubmit, submitting, questions, answers, minCommon, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Sorular yükleniyor...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={['#0B1020', '#1a1f35', '#0B1020']} style={styles.gradient}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.timer}>{Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</Text>
        </View>

        <Text style={styles.title}>En az kaç ortak cevap olsun?</Text>
        <View style={styles.minCommonRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setMinCommon(n)}
              style={[styles.minCommonBtn, minCommon === n && styles.minCommonBtnActive]}
            >
              <Text style={[styles.minCommonText, minCommon === n && styles.minCommonTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {questions.map((q) => (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>{q.questionText}</Text>
              {q.options.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => handleSelect(q.id, opt.id)}
                  style={[styles.optionBtn, answers[q.id] === opt.id && styles.optionBtnActive]}
                >
                  <Text style={[styles.optionText, answers[q.id] === opt.id && styles.optionTextActive]}>
                    {opt.optionText}
                  </Text>
                  {answers[q.id] === opt.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
        >
          <LinearGradient
            colors={canSubmit && !submitting ? [COLORS.primary, COLORS.accent] : ['#333', '#444']}
            style={styles.submitGradient}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Gönder ve Eşleşmeyi Ara</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: SPACING.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...FONTS.body, color: COLORS.textMuted, marginTop: SPACING.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  backBtn: { padding: SPACING.sm },
  timer: { ...FONTS.h3, color: COLORS.accent, fontVariant: ['tabular-nums'] },
  title: { ...FONTS.h3, color: COLORS.text, marginBottom: SPACING.md },
  minCommonRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  minCommonBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  minCommonBtnActive: { backgroundColor: COLORS.primary, borderWidth: 1, borderColor: COLORS.accent },
  minCommonText: { ...FONTS.body, color: COLORS.textMuted },
  minCommonTextActive: { color: COLORS.text, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.xl },
  questionBlock: { marginBottom: SPACING.xl },
  questionText: { ...FONTS.body, color: COLORS.text, marginBottom: SPACING.sm, fontWeight: '600' },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '20' },
  optionText: { ...FONTS.body, color: COLORS.text, flex: 1 },
  optionTextActive: { color: COLORS.text, fontWeight: '600' },
  submitBtn: { marginBottom: SPACING.lg },
  submitBtnDisabled: { opacity: 0.7 },
  submitGradient: {
    paddingVertical: SPACING.md,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitText: { ...FONTS.button, color: '#fff' },
});

export default MatchQuestionsScreen;
