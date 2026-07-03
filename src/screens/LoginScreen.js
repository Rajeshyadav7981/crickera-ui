import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { COLORS, GRADIENTS, FONTS } from '../theme';
import { Feather } from '@expo/vector-icons';

// Login is mobile + password only — no OTP. OTP is reserved for Register and
// Forgot/Reset Password (where proving phone ownership matters), which keeps
// SMS costs down and matches how most apps sign users in.
const LoginScreen = ({ navigation, route }) => {
  const { login } = useAuth();
  const toast = useToast();

  const [mobile, setMobile] = useState(route?.params?.prefilledMobile || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleMobileChange = (text) => setMobile(text.replace(/[^0-9]/g, ''));

  const handleLogin = async () => {
    const m = mobile.trim();
    if (m.length !== 10 || !/^[6-9]\d{9}$/.test(m)) {
      toast.warning('Invalid Mobile', 'Enter a valid 10-digit number starting with 6–9');
      return;
    }
    if (!password.trim()) {
      toast.warning('Enter your password');
      return;
    }
    setLoading(true);
    try {
      await login(m, password);
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 429) {
        toast.warning('Please Wait', detail || 'Too many attempts. Try again in a moment.');
      } else {
        // Backend returns 401 with a clear message for both "no account" and
        // "wrong password" (it won't reveal which). Show it; user can tap Sign Up.
        toast.error('Login Failed', detail || 'Invalid mobile number or password');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />

        <View style={s.topRow}>
          <View style={s.backBtn} />
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            }}
            style={s.skipBtn}
            activeOpacity={0.7}
          >
            <Text style={s.skipText}>Skip</Text>
            <Feather name="arrow-right" size={14} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={120}
        >
          <Animated.View style={[s.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <View style={s.headerSection}>
              <View style={s.iconCircle}>
                <Feather name="lock" size={28} color={COLORS.ACCENT} />
              </View>
              <Text style={s.welcomeTitle}>Welcome Back</Text>
              <Text style={s.welcomeSubtitle}>Sign in with your mobile number and password</Text>
            </View>

            <View style={s.card}>
              {/* Mobile */}
              <View style={s.inputWrapper}>
                <Feather name="phone" size={18} color={COLORS.TEXT_MUTED} />
                <TextInput
                  style={s.input}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={mobile}
                  onChangeText={handleMobileChange}
                  keyboardType="number-pad"
                  maxLength={10}
                  autoFocus
                />
                {mobile.length > 0 && (
                  <Text style={{ fontSize: 11, color: mobile.length === 10 ? COLORS.SUCCESS : COLORS.TEXT_MUTED }}>
                    {mobile.length}/10
                  </Text>
                )}
              </View>

              {/* Password */}
              <View style={s.inputWrapper}>
                <Feather name="lock" size={18} color={COLORS.TEXT_MUTED} />
                <TextInput
                  style={s.input}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.TEXT_MUTED}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureText}
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                />
                <TouchableOpacity onPress={() => setSecureText(!secureText)} style={s.eyeBtn}>
                  <Feather name={secureText ? 'eye-off' : 'eye'} size={18} color={COLORS.TEXT_MUTED} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[s.primaryBtn, loading && s.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGradient}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Sign In</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.forgotRow}
                onPress={() => navigation.navigate('ForgotPassword', { prefilledMobile: mobile.trim() })}
                activeOpacity={0.7}
              >
                <Text style={s.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <View style={s.footer}>
              <Text style={s.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7}>
                <Text style={s.signUpText}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },

  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 6,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  skipText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },

  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  content: { alignItems: 'center' },

  headerSection: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  welcomeTitle: { fontFamily: FONTS.family, fontSize: 26, fontWeight: '800', color: COLORS.TEXT, marginBottom: 6 },
  welcomeSubtitle: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  // Card
  card: {
    width: '100%', backgroundColor: COLORS.CARD, borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },

  // Inputs
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE, paddingHorizontal: 14, marginBottom: 14,
  },
  input: { fontFamily: FONTS.family, flex: 1, fontSize: 15, color: COLORS.TEXT, height: '100%', marginLeft: 10 },
  eyeBtn: { paddingLeft: 10 },

  // Primary button
  primaryBtn: {
    borderRadius: 12, overflow: 'hidden', marginTop: 4,
    shadowColor: COLORS.ACCENT, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  primaryBtnGradient: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontFamily: FONTS.family, color: '#fff', fontSize: 16, fontWeight: '700' },

  // Forgot
  forgotRow: { alignSelf: 'center', marginTop: 16 },
  forgotText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.ACCENT },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  footerText: { fontFamily: FONTS.family, fontSize: 14, color: COLORS.TEXT_SECONDARY },
  signUpText: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.ACCENT },
});

export default LoginScreen;
