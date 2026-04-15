import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, GRADIENTS } from '../theme';

const SplashScreen = ({ onFinish }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Fade in the entire screen
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Hold for a moment
      Animated.delay(1200),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />

      <Animated.View style={[styles.centerContent, { opacity: fadeAnim }]}>
        {/* Cricket ball icon */}
        <Text style={styles.icon}>&#127951;</Text>

        {/* Title */}
        <Text style={styles.title}>CreckStars</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Your Cricket Companion</Text>

        {/* Loading indicator */}
        <ActivityIndicator
          size="large"
          color={COLORS.ACCENT}
          style={styles.loader}
        />
      </Animated.View>

      {/* Bottom branding */}
      <Animated.View style={[styles.bottomContainer, { opacity: fadeAnim }]}>
        <Text style={styles.poweredBy}>Powered by CreckStars</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 32,
  },
  loader: {
    marginTop: 8,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  poweredBy: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
  },
});

export default SplashScreen;
