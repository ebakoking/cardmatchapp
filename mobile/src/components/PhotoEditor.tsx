import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../theme/colors';
import { SPACING } from '../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onSave: (editedUri: string) => void;
}

// Emoji seçenekleri
const EMOJI_OPTIONS = ['😊', '😎', '🙈', '👻', '🔥', '💀', '🎭', '⭐', '❤️', '🤫'];

// Boyut seçenekleri
const SIZE_OPTIONS = [
  { label: 'S', size: 40 },
  { label: 'M', size: 60 },
  { label: 'L', size: 80 },
  { label: 'XL', size: 100 },
];

interface EmojiOverlay {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

const PhotoEditor: React.FC<Props> = ({ visible, imageUri, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const captureViewRef = useRef<View>(null);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojis, setEmojis] = useState<EmojiOverlay[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState('😊');
  const [selectedEmojiId, setSelectedEmojiId] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState(60);
  
  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const emojiStartPos = useRef({ x: 0, y: 0 });

  // Safe area hesaplama
  const topInset = insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44);
  const bottomInset = insets.bottom || (Platform.OS === 'android' ? 24 : 34);

  // Kullanılabilir alan - fotoğraf büyük görünsün
  const headerHeight = 56;
  const toolbarHeight = 70;
  const emojiPickerHeight = showEmojiPicker ? 130 : 0;
  const paddingTotal = 40;
  const availableHeight = SCREEN_HEIGHT - topInset - bottomInset - headerHeight - toolbarHeight - emojiPickerHeight - paddingTotal;
  const maxImageWidth = SCREEN_WIDTH - 20;
  const maxImageHeight = Math.max(availableHeight, 300);

  // Load image dimensions
  useEffect(() => {
    if (imageUri && visible) {
      Image.getSize(
        imageUri,
        (w, h) => {
          setOriginalSize({ width: w, height: h });
          
          const aspectRatio = w / h;
          let displayWidth = maxImageWidth;
          let displayHeight = displayWidth / aspectRatio;

          if (displayHeight > maxImageHeight) {
            displayHeight = maxImageHeight;
            displayWidth = displayHeight * aspectRatio;
          }

          // Minimum boyut
          if (displayWidth < 200) displayWidth = 200;
          if (displayHeight < 200) displayHeight = 200;

          setDisplaySize({
            width: Math.floor(displayWidth),
            height: Math.floor(displayHeight),
          });
        },
        (error) => {
          console.error('Image size error:', error);
          setDisplaySize({
            width: maxImageWidth,
            height: maxImageWidth * 0.75,
          });
          setOriginalSize({
            width: 1080,
            height: 1080,
          });
        }
      );
    }
  }, [imageUri, visible, maxImageWidth, maxImageHeight]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setRotation(0);
      setFlipH(false);
      setIsProcessing(false);
      setEmojis([]);
      setShowEmojiPicker(false);
      setSelectedEmojiId(null);
      setDraggingId(null);
    }
  }, [visible]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFlip = () => {
    setFlipH((prev) => !prev);
  };

  const handleAddEmoji = () => {
    const newEmoji: EmojiOverlay = {
      id: Date.now().toString(),
      emoji: selectedEmoji,
      x: (displaySize.width - selectedSize) / 2,
      y: (displaySize.height - selectedSize) / 2,
      size: selectedSize,
    };
    setEmojis([...emojis, newEmoji]);
    setSelectedEmojiId(newEmoji.id);
  };

  const handleResizeSelected = (newSize: number) => {
    if (selectedEmojiId) {
      setEmojis((prev) =>
        prev.map((e) => (e.id === selectedEmojiId ? { ...e, size: newSize } : e))
      );
    }
    setSelectedSize(newSize);
  };

  const handleRemoveSelected = () => {
    if (selectedEmojiId) {
      setEmojis((prev) => prev.filter((e) => e.id !== selectedEmojiId));
      setSelectedEmojiId(null);
    }
  };

  // Emoji touch handlers
  const handleEmojiTouchStart = (id: string, pageX: number, pageY: number) => {
    const emoji = emojis.find(e => e.id === id);
    if (emoji) {
      setDraggingId(id);
      setSelectedEmojiId(id);
      dragStartPos.current = { x: pageX, y: pageY };
      emojiStartPos.current = { x: emoji.x, y: emoji.y };
    }
  };

  const handleEmojiTouchMove = (pageX: number, pageY: number) => {
    if (!draggingId) return;
    
    const deltaX = pageX - dragStartPos.current.x;
    const deltaY = pageY - dragStartPos.current.y;
    
    const emoji = emojis.find(e => e.id === draggingId);
    if (!emoji) return;
    
    // Yeni pozisyon (sınırlar içinde)
    const newX = Math.max(0, Math.min(displaySize.width - emoji.size, emojiStartPos.current.x + deltaX));
    const newY = Math.max(0, Math.min(displaySize.height - emoji.size, emojiStartPos.current.y + deltaY));
    
    setEmojis((prev) =>
      prev.map((e) => (e.id === draggingId ? { ...e, x: newX, y: newY } : e))
    );
  };

  const handleEmojiTouchEnd = () => {
    if (draggingId) {
      const emoji = emojis.find(e => e.id === draggingId);
      if (emoji) {
        emojiStartPos.current = { x: emoji.x, y: emoji.y };
      }
    }
    setDraggingId(null);
  };

  const handleSave = async () => {
    try {
      setIsProcessing(true);

      let finalUri = imageUri;

      // Rotation veya flip varsa önce uygula
      if (rotation !== 0 || flipH) {
        const actions: ImageManipulator.Action[] = [];
        if (rotation !== 0) {
          actions.push({ rotate: rotation });
        }
        if (flipH) {
          actions.push({ flip: ImageManipulator.FlipType.Horizontal });
        }
        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          actions,
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = result.uri;
      }

      // Emoji varsa view-shot ile yakala
      if (emojis.length > 0 && captureViewRef.current) {
        try {
          // View'ı yakala (yüksek kalite)
          const capturedUri = await captureRef(captureViewRef, {
            format: 'jpg',
            quality: 0.95,
            result: 'tmpfile',
          });
          finalUri = capturedUri;
        } catch (captureError) {
          console.error('Capture error:', captureError);
          // Hata durumunda orijinal görseli gönder
        }
      }

      onSave(finalUri);
    } catch (error) {
      console.error('Photo edit error:', error);
      onSave(imageUri);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedEmojiData = emojis.find((e) => e.id === selectedEmojiId);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={[styles.container, { paddingTop: topInset, paddingBottom: bottomInset }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Fotoğraf</Text>

          <TouchableOpacity
            onPress={handleSave}
            style={styles.sendButton}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <View style={styles.sendButtonLoading}>
                <ActivityIndicator size="small" color={COLORS.text} />
              </View>
            ) : (
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                style={styles.sendButtonGradient}
              >
                <Ionicons name="send" size={16} color={COLORS.text} />
                <Text style={styles.sendButtonText}>Gönder</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        {/* Image Preview with Emojis */}
        <View style={styles.imageContainer}>
          <View
            ref={captureViewRef}
            collapsable={false}
            style={[
              styles.captureView,
              {
                width: displaySize.width || maxImageWidth,
                height: displaySize.height || 300,
              },
            ]}
            onTouchMove={(e) => handleEmojiTouchMove(e.nativeEvent.pageX, e.nativeEvent.pageY)}
            onTouchEnd={handleEmojiTouchEnd}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={[
                  styles.image,
                  {
                    width: '100%',
                    height: '100%',
                    transform: [
                      { rotate: `${rotation}deg` },
                      { scaleX: flipH ? -1 : 1 },
                    ],
                  },
                ]}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={48} color={COLORS.textMuted} />
              </View>
            )}

            {/* Emojis */}
            {emojis.map((e) => (
              <View
                key={e.id}
                onTouchStart={(evt) => handleEmojiTouchStart(e.id, evt.nativeEvent.pageX, evt.nativeEvent.pageY)}
                style={[
                  styles.emojiWrapper,
                  {
                    left: e.x,
                    top: e.y,
                    width: e.size,
                    height: e.size,
                  },
                  e.id === selectedEmojiId && styles.emojiSelected,
                ]}
              >
                <Text style={[styles.emojiText, { fontSize: e.size * 0.8 }]}>{e.emoji}</Text>
              </View>
            ))}
          </View>

          {emojis.length > 0 && (
            <Text style={styles.hint}>Emojiyi parmağınla sürükle</Text>
          )}
        </View>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <View style={styles.emojiPickerContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiScroll}>
              {EMOJI_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiOption, selectedEmoji === emoji && styles.emojiOptionSelected]}
                  onPress={() => setSelectedEmoji(emoji)}
                >
                  <Text style={styles.emojiOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sizeRow}>
              <Text style={styles.sizeLabel}>Boyut:</Text>
              {SIZE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  style={[styles.sizeOption, selectedSize === opt.size && styles.sizeOptionSelected]}
                  onPress={() => handleResizeSelected(opt.size)}
                >
                  <Text style={[styles.sizeOptionText, selectedSize === opt.size && styles.sizeOptionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
              
              <TouchableOpacity style={styles.addEmojiButton} onPress={handleAddEmoji}>
                <Ionicons name="add" size={16} color={COLORS.text} />
                <Text style={styles.addEmojiButtonText}>Ekle</Text>
              </TouchableOpacity>

              {selectedEmojiId && (
                <TouchableOpacity style={styles.removeButton} onPress={handleRemoveSelected}>
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Tools */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolButton} onPress={handleRotate}>
            <View style={styles.toolIconWrapper}>
              <Ionicons name="reload-outline" size={20} color={COLORS.text} />
            </View>
            <Text style={styles.toolText}>Döndür</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={handleFlip}>
            <View style={[styles.toolIconWrapper, flipH && styles.toolIconActive]}>
              <Ionicons name="swap-horizontal-outline" size={20} color={flipH ? COLORS.primary : COLORS.text} />
            </View>
            <Text style={[styles.toolText, flipH && styles.toolTextActive]}>Ayna</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
            <View style={[styles.toolIconWrapper, showEmojiPicker && styles.toolIconActive]}>
              <Text style={{ fontSize: 18 }}>😊</Text>
            </View>
            <Text style={[styles.toolText, showEmojiPicker && styles.toolTextActive]}>Emoji</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    height: 56,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonLoading: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  sendButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 6,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  captureView: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  image: {
    borderRadius: 12,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.accent,
  },
  emojiWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  emojiText: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  emojiPickerContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: SPACING.sm,
    borderRadius: 12,
    marginBottom: SPACING.xs,
  },
  emojiScroll: {
    marginBottom: SPACING.sm,
  },
  emojiOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  emojiOptionSelected: {
    backgroundColor: COLORS.primary + '40',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  emojiOptionText: {
    fontSize: 22,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sizeLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginRight: SPACING.xs,
  },
  sizeOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 4,
  },
  sizeOptionSelected: {
    backgroundColor: COLORS.primary,
  },
  sizeOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  sizeOptionTextSelected: {
    color: COLORS.text,
  },
  addEmojiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: SPACING.sm,
    gap: 3,
  },
  addEmojiButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,68,68,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xl,
  },
  toolButton: {
    alignItems: 'center',
  },
  toolIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  toolIconActive: {
    backgroundColor: COLORS.primary + '30',
  },
  toolText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  toolTextActive: {
    color: COLORS.primary,
  },
});

export default PhotoEditor;
