import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, StatusBar } from 'react-native';
import * as ExpoSplash from 'expo-splash-screen';
import { LinearGradient } from 'expo-linear-gradient';

const BG = '#010006';
const HOLD_MS = 1700;
const LOGO = 210;

const SplashScreen = ({ onFinish }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  const hideNative = () => { ExpoSplash.hideAsync().catch(() => {}); };

  useEffect(() => {
    Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }).start();
    Animated.timing(line, { toValue: 1, duration: 700, delay: 350, useNativeDriver: true }).start();
    Animated.timing(shine, { toValue: 1, duration: 950, delay: 250, useNativeDriver: true }).start();

    const t = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, []);

  const shineX = shine.interpolate({ inputRange: [0, 1], outputRange: [-LOGO * 0.7, LOGO * 0.95] });

  return (
    <View style={styles.container} onLayout={hideNative}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <Animated.View style={[styles.glow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />
        <View style={styles.logoClip}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
          <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: '18deg' }] }]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.32)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shineFill}
            />
          </Animated.View>
        </View>
        <Animated.View style={[styles.line, { transform: [{ scaleX: line }] }]} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: LOGO * 1.6,
    height: LOGO * 1.6,
    borderRadius: LOGO,
    backgroundColor: '#1E88E5',
    top: -LOGO * 0.3,
  },
  logoClip: { width: LOGO, height: LOGO, overflow: 'hidden', borderRadius: 44 },
  logo: { width: LOGO, height: LOGO },
  shine: { position: 'absolute', top: -LOGO * 0.4, width: LOGO * 0.42, height: LOGO * 1.8 },
  shineFill: { flex: 1 },
  line: {
    marginTop: 22,
    width: 132,
    height: 3,
    borderRadius: 3,
    backgroundColor: '#1E88E5',
  },
});

export default SplashScreen;
