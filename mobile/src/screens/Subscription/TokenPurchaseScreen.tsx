import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { purchaseTokens } from '../../services/iap';
import { useAuth } from '../../context/AuthContext';

const TokenPurchaseScreen: React.FC = () => {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    try {
      setLoading(true);
      await purchaseTokens();
      await refreshProfile();
    } catch (error) {
      // TODO toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={FONTS.h2}>Elmas Satın Al</Text>
        <Text style={[FONTS.h3, { marginTop: SPACING.sm }]}>
          50: 49,99 TL · 100: 79,99 TL · 250: 149,99 TL
        </Text>

        <View style={styles.benefits}>
          <Text style={FONTS.body}>📸 Ekstra fotoğraf gönder (5 elmas)</Text>
          <Text style={FONTS.body}>🎥 Ekstra video gönder (10 elmas)</Text>
          <Text style={FONTS.body}>🎁 Arkadaşlarına hediye et</Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={handlePurchase}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={FONTS.button}>Satın Al</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  benefits: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
    width: '100%',
  },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    width: '100%',
  },
});

export default TokenPurchaseScreen;
