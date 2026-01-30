import { useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

const MAX_DURATION_MS = 30000; // 30 saniye

interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingDuration: number; // saniye
  recordedUri: string | null; // Kaydedilen ses URI'si (önizleme için)
  recordedDuration: number; // Kaydedilen ses süresi
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>; // URI döndürür
  cancelRecording: () => Promise<void>;
  clearRecording: () => void; // Önizlemeyi temizle
  playPreview: () => Promise<void>; // Önizleme çal
  stopPreview: () => Promise<void>; // Önizlemeyi durdur
  isPlayingPreview: boolean;
}

export const useAudioRecorder = (): UseAudioRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // İzin iste
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Ses kaydı için mikrofon izni vermeniz gerekiyor.');
        return;
      }

      // Audio mode ayarla
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Yeni kayıt başlat
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Süre sayacı
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Maksimum süre (30 saniye)
      maxDurationTimeoutRef.current = setTimeout(async () => {
        console.log('[AudioRecorder] Max duration reached, stopping...');
        await stopRecording();
      }, MAX_DURATION_MS);

      console.log('[AudioRecorder] Recording started');
    } catch (error) {
      console.error('[AudioRecorder] Failed to start recording:', error);
      Alert.alert('Hata', 'Ses kaydı başlatılamadı.');
      cleanup();
    }
  }, [cleanup]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    try {
      if (!recordingRef.current) {
        console.log('[AudioRecorder] No recording to stop');
        cleanup();
        return null;
      }

      const duration = recordingDuration;
      
      // Minimum 1 saniye kontrolü
      if (duration < 1) {
        console.log('[AudioRecorder] Recording too short, cancelling...');
        await cancelRecording();
        return null;
      }

      console.log('[AudioRecorder] Stopping recording...');
      
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      // Audio mode'u sıfırla
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      recordingRef.current = null;
      
      // Önizleme için sakla
      if (uri) {
        setRecordedUri(uri);
        setRecordedDuration(duration);
      }
      
      cleanup();

      console.log('[AudioRecorder] Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('[AudioRecorder] Failed to stop recording:', error);
      cleanup();
      return null;
    }
  }, [cleanup, recordingDuration]);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        console.log('[AudioRecorder] Cancelling recording...');
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      cleanup();
      console.log('[AudioRecorder] Recording cancelled');
    } catch (error) {
      console.error('[AudioRecorder] Failed to cancel recording:', error);
      cleanup();
    }
  }, [cleanup]);

  // Kaydı temizle (önizleme sonrası)
  const clearRecording = useCallback(() => {
    setRecordedUri(null);
    setRecordedDuration(0);
    setIsPlayingPreview(false);
    if (previewSoundRef.current) {
      previewSoundRef.current.unloadAsync();
      previewSoundRef.current = null;
    }
  }, []);

  // Önizleme çal
  const playPreview = useCallback(async () => {
    if (!recordedUri) return;
    
    try {
      // Önceki sesi temizle
      if (previewSoundRef.current) {
        await previewSoundRef.current.unloadAsync();
      }
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedUri },
        { shouldPlay: true },
        (status: any) => {
          if (status.didJustFinish) {
            setIsPlayingPreview(false);
          }
        }
      );
      
      previewSoundRef.current = sound;
      setIsPlayingPreview(true);
    } catch (error) {
      console.error('[AudioRecorder] Failed to play preview:', error);
    }
  }, [recordedUri]);

  // Önizlemeyi durdur
  const stopPreview = useCallback(async () => {
    if (previewSoundRef.current) {
      await previewSoundRef.current.pauseAsync();
      setIsPlayingPreview(false);
    }
  }, []);

  return {
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
  };
};

export default useAudioRecorder;
