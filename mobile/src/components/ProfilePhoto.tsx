import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { getPhotoUrl } from '../utils/photoUrl';

interface Props {
  uri?: string | null;
  size?: number;
  online?: boolean;
}

export const ProfilePhoto: React.FC<Props> = ({ uri, size = 50, online }) => {
  const [loadError, setLoadError] = useState(false);
  const fullUri = uri ? getPhotoUrl(uri) : '';
  const hasValidUri = fullUri && (fullUri.startsWith('http') || fullUri.startsWith('file:'));

  const showPlaceholder = !hasValidUri || loadError;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {showPlaceholder ? (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <Image
          source={{ uri: fullUri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          resizeMode="cover"
          onError={(e) => {
            console.log('[ProfilePhoto] ❌ Image load error:', {
              uri: fullUri.substring(0, 100),
              error: e.nativeEvent.error,
            });
            setLoadError(true);
          }}
          onLoad={() => {
            console.log('[ProfilePhoto] ✅ Image loaded successfully:', fullUri.substring(0, 100));
          }}
        />
      )}
      {online && <View style={[styles.onlineDot, { width: size * 0.25, height: size * 0.25, borderRadius: size * 0.125 }]} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: COLORS.surface,
  },
  placeholder: {
    backgroundColor: COLORS.surface,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
});

export default ProfilePhoto;
