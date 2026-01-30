import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme/colors';
import { FONTS } from '../../theme/fonts';
import { SPACING } from '../../theme/spacing';
import { purchaseSubscription } from '../../services/iap';
import { useAuth } from '../../context/AuthContext';

const SubscriptionScreen: React.FC = () => {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      await purchaseSubscription();
      await refreshProfile();
    } catch (error) {
      // TODO toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={FONTS.h2}>Plus Üyelik</Text>
      <Text style={[FONTS.caption, { marginTop: SPACING.sm }]}>
        59.90 TL/ay
      </Text>

      <View style={styles.benefits}>
        <Text style={FONTS.body}>🔍 Yaş, şehir, ülke filtreleri</Text>
        <Text style={FONTS.body}>⭐ Özel rozet</Text>
        <Text style={FONTS.body}>🚀 Öncelikli eşleşme</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSubscribe}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <Text style={FONTS.button}>Abone Ol</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  benefits: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
});

export default SubscriptionScreen;
