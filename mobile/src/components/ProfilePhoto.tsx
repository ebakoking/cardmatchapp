import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';
import { getPhotoUrl } from '../utils/photoUrl';

interface Props {
  uri: string;
  size?: number;
  online?: boolean;
}

export const ProfilePhoto: React.FC<Props> = ({ uri, size = 50, online }) => {
  // URL'yi tam hale getir (relative ise API base URL ekle)
  const fullUri = getPhotoUrl(uri);
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: fullUri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
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
