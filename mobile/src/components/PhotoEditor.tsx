import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  PanResponder,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { SPACING } from '../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
  onSave: (editedUri: string) => void;
}

interface DrawPath {
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

const COLORS_PALETTE = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'];
const STROKE_WIDTHS = [2, 4, 8, 12];

const PhotoEditor: React.FC<Props> = ({ visible, imageUri, onClose, onSave }) => {
  const [editMode, setEditMode] = useState<'crop' | 'draw' | null>(null);
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawPath | null>(null);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Crop state
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 200 });

  // Drawing pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editMode === 'draw',
      onMoveShouldSetPanResponder: () => editMode === 'draw',
      onPanResponderGrant: (evt) => {
        if (editMode !== 'draw') return;
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath({
          points: [{ x: locationX, y: locationY }],
          color: selectedColor,
          strokeWidth,
        });
      },
      onPanResponderMove: (evt) => {
        if (editMode !== 'draw' || !currentPath) return;
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            points: [...prev.points, { x: locationX, y: locationY }],
          };
        });
      },
      onPanResponderRelease: () => {
        if (currentPath && currentPath.points.length > 0) {
          setPaths((prev) => [...prev, currentPath]);
        }
        setCurrentPath(null);
      },
    })
  ).current;

  // Load image dimensions
  React.useEffect(() => {
    if (imageUri) {
      Image.getSize(imageUri, (w, h) => {
        const maxWidth = SCREEN_WIDTH - 40;
        const maxHeight = SCREEN_HEIGHT * 0.5;
        const ratio = Math.min(maxWidth / w, maxHeight / h);
        setImageSize({ width: w * ratio, height: h * ratio });
      });
    }
  }, [imageUri]);

  const handleCrop = async () => {
    try {
      setIsProcessing(true);
      
      // Calculate crop coordinates relative to original image
      Image.getSize(imageUri, async (originalWidth, originalHeight) => {
        const scaleX = originalWidth / imageSize.width;
        const scaleY = originalHeight / imageSize.height;

        const result = await ImageManipulator.manipulateAsync(
          imageUri,
          [
            {
              crop: {
                originX: Math.max(0, cropArea.x * scaleX),
                originY: Math.max(0, cropArea.y * scaleY),
                width: Math.min(originalWidth, cropArea.width * scaleX),
                height: Math.min(originalHeight, cropArea.height * scaleY),
              },
            },
          ],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );

        setIsProcessing(false);
        onSave(result.uri);
      });
    } catch (error) {
      console.error('Crop error:', error);
      setIsProcessing(false);
      Alert.alert('Hata', 'Fotoğraf kırpılamadı.');
      onSave(imageUri); // Fallback: orijinal görseli gönder
    }
  };

  const handleSave = async () => {
    if (editMode === 'crop') {
      await handleCrop();
    } else if (editMode === 'draw' && paths.length > 0) {
      // For drawing, we'll just save the original image
      // Real drawing would require a canvas library like react-native-svg or react-native-canvas
      Alert.alert('Bilgi', 'Çizim özelliği için SVG desteği gerekiyor. Şimdilik fotoğraf kaydediliyor.');
      onSave(imageUri);
    } else {
      onSave(imageUri);
    }
  };

  const handleUndo = () => {
    if (editMode === 'draw') {
      setPaths((prev) => prev.slice(0, -1));
    }
  };

  const renderDrawTools = () => (
    <View style={styles.toolsContainer}>
      <Text style={styles.toolLabel}>Renk:</Text>
      <View style={styles.colorPalette}>
        {COLORS_PALETTE.map((color) => (
          <TouchableOpacity
            key={color}
            style={[
              styles.colorOption,
              { backgroundColor: color },
              selectedColor === color && styles.colorSelected,
            ]}
            onPress={() => setSelectedColor(color)}
          />
        ))}
      </View>
      <Text style={styles.toolLabel}>Kalınlık:</Text>
      <View style={styles.strokeOptions}>
        {STROKE_WIDTHS.map((w) => (
          <TouchableOpacity
            key={w}
            style={[
              styles.strokeOption,
              strokeWidth === w && styles.strokeSelected,
            ]}
            onPress={() => setStrokeWidth(w)}
          >
            <View style={[styles.strokePreview, { height: w }]} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCropOverlay = () => (
    <View style={styles.cropOverlay}>
      {/* Dimmed areas outside crop */}
      <View style={[styles.cropDim, { top: 0, left: 0, right: 0, height: cropArea.y }]} />
      <View style={[styles.cropDim, { top: cropArea.y, left: 0, width: cropArea.x, height: cropArea.height }]} />
      <View style={[styles.cropDim, { top: cropArea.y, right: 0, left: cropArea.x + cropArea.width, height: cropArea.height }]} />
      <View style={[styles.cropDim, { bottom: 0, left: 0, right: 0, top: cropArea.y + cropArea.height }]} />
      
      {/* Crop area border */}
      <View style={[styles.cropArea, { 
        left: cropArea.x, 
        top: cropArea.y, 
        width: cropArea.width, 
        height: cropArea.height 
      }]}>
        {/* Corner handles */}
        <View style={[styles.cropHandle, styles.cropHandleTL]} />
        <View style={[styles.cropHandle, styles.cropHandleTR]} />
        <View style={[styles.cropHandle, styles.cropHandleBL]} />
        <View style={[styles.cropHandle, styles.cropHandleBR]} />
      </View>
    </View>
  );

  const renderDrawPaths = () => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {paths.map((path, pathIndex) => (
        <View key={pathIndex} style={StyleSheet.absoluteFill}>
          {path.points.map((point, pointIndex) => (
            pointIndex > 0 && (
              <View
                key={pointIndex}
                style={[
                  styles.drawPoint,
                  {
                    left: point.x - path.strokeWidth / 2,
                    top: point.y - path.strokeWidth / 2,
                    width: path.strokeWidth,
                    height: path.strokeWidth,
                    backgroundColor: path.color,
                  },
                ]}
              />
            )
          ))}
        </View>
      ))}
      {currentPath && currentPath.points.map((point, index) => (
        index > 0 && (
          <View
            key={`current-${index}`}
            style={[
              styles.drawPoint,
              {
                left: point.x - currentPath.strokeWidth / 2,
                top: point.y - currentPath.strokeWidth / 2,
                width: currentPath.strokeWidth,
                height: currentPath.strokeWidth,
                backgroundColor: currentPath.color,
              },
            ]}
          />
        )
      ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Fotoğraf Düzenle</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButton}
            disabled={isProcessing}
          >
            <Ionicons name="checkmark" size={28} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Mode Selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeButton, editMode === 'crop' && styles.modeButtonActive]}
            onPress={() => setEditMode(editMode === 'crop' ? null : 'crop')}
          >
            <Ionicons name="crop" size={24} color={editMode === 'crop' ? COLORS.primary : COLORS.text} />
            <Text style={[styles.modeText, editMode === 'crop' && styles.modeTextActive]}>Kırp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, editMode === 'draw' && styles.modeButtonActive]}
            onPress={() => setEditMode(editMode === 'draw' ? null : 'draw')}
          >
            <Ionicons name="brush" size={24} color={editMode === 'draw' ? COLORS.primary : COLORS.text} />
            <Text style={[styles.modeText, editMode === 'draw' && styles.modeTextActive]}>Çiz</Text>
          </TouchableOpacity>
          {editMode === 'draw' && paths.length > 0 && (
            <TouchableOpacity style={styles.undoButton} onPress={handleUndo}>
              <Ionicons name="arrow-undo" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Image Canvas */}
        <View style={styles.canvasContainer} {...(editMode === 'draw' ? panResponder.panHandlers : {})}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, { width: imageSize.width, height: imageSize.height }]}
            resizeMode="contain"
          />
          {editMode === 'crop' && renderCropOverlay()}
          {editMode === 'draw' && renderDrawPaths()}
        </View>

        {/* Tools */}
        {editMode === 'draw' && renderDrawTools()}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            {editMode === 'crop' && 'Kırpmak istediğiniz alanı seçin'}
            {editMode === 'draw' && 'Parmağınızla çizin'}
            {!editMode && 'Düzenleme modu seçin'}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface,
  },
  headerButton: {
    padding: SPACING.xs,
  },
  title: {
    ...FONTS.h3,
    color: COLORS.text,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.lg,
  },
  modeButton: {
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    minWidth: 70,
  },
  modeButtonActive: {
    backgroundColor: COLORS.primary + '30',
  },
  modeText: {
    ...FONTS.caption,
    color: COLORS.text,
    marginTop: 4,
  },
  modeTextActive: {
    color: COLORS.primary,
  },
  undoButton: {
    padding: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  canvasContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cropDim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  cropArea: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  cropHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  cropHandleTL: { top: -10, left: -10 },
  cropHandleTR: { top: -10, right: -10 },
  cropHandleBL: { bottom: -10, left: -10 },
  cropHandleBR: { bottom: -10, right: -10 },
  drawPoint: {
    position: 'absolute',
    borderRadius: 100,
  },
  toolsContainer: {
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  toolLabel: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelected: {
    borderColor: COLORS.text,
  },
  strokeOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  strokeOption: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strokeSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  strokePreview: {
    width: 30,
    backgroundColor: COLORS.text,
    borderRadius: 4,
  },
  instructions: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  instructionText: {
    ...FONTS.caption,
    color: COLORS.textMuted,
  },
});

export default PhotoEditor;
