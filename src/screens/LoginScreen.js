import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { useToast } from '../components/Toast';
import OTPInput from '../components/OTPInput';
import useOtpCountdown, { formatCountdown } from '../hooks/useOtpCountdown';
import { COLORS, GRADIENTS, FONTS } from '../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const toast = useToast();

  // Step: 1 = mobile, 2 = OTP, 3 = password
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  // Drives both the validity countdown and the resend cooldown.
  const otpTimer = useOtpCountdown(30);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleMobileChange = (text) => setMobile(text.replace(/[^0-9]/g, ''));

  // Step 1 → Step 2: validate mobile + send OTP
  const handleSendOtp = async () => {
    const m = mobile.trim();
    if (!m || m.length !== 10) {
      toast.warning('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.sendOTP(m, 'login');
      toast.success('OTP Sent', 'Check your phone for the verification code');
      setStep(2);
      otpTimer.start(res.data?.expires_in);
    } catch (err) {
      const detail = err.response?.status === 429
        ? (err.response?.data?.detail || 'Too many requests. Please wait a moment and try again.')
        : (err.response?.data?.detail || 'Could not send OTP');
      toast.error('Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpTimer.canResend || loading) return;
    setLoading(true);
    try {
      const res = await authAPI.sendOTP(mobile.trim(), 'login');
      toast.success('OTP Resent', 'New code sent');
      otpTimer.start(res.data?.expires_in);
      setOtp('');
    } catch (err) {
      const detail = err.response?.status === 429
        ? (err.response?.data?.detail || 'Too many requests. Please wait before resending.')
        : (err.response?.data?.detail || 'Could not resend OTP');
      toast.error('Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3: verify the OTP with the backend, then advance to password.
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.warning('Enter the 6-digit OTP');
      return;
    }
    if (otpTimer.expired) {
      toast.warning('Code expired', 'Tap Resend OTP to get a new code.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.verifyOTP(mobile.trim(), otp, 'login');
      setStep(3);
    } catch (err) {
      toast.error('Verification Failed', err.response?.data?.detail || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: login with password
  const handleLogin = async () => {
    if (!password.trim()) {
      toast.warning('Enter your password');
      return;
    }
    setLoading(true);
    try {
      await login(mobile.trim(), password);
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.detail || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 1) navigation.goBack();
    else {
      setStep(step - 1);
      if (step === 2) setOtp('');
      if (step === 3) setPassword('');
    }
  };

  const stepConfig = {
    1: { icon: 'phone', title: 'Welcome Back', subtitle: 'Enter your mobile number to sign in' },
    2: { icon: 'shield', title: 'Verify OTP', subtitle: `Enter the 6-digit code sent to ${mobile}` },
    3: { icon: 'lock', title: 'Enter Password', subtitle: `Signing in as ${mobile}` },
  };
  const { icon, title, subtitle } = stepConfig[step];

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />

        <View style={s.topRow}>
          {step > 1 ? (
            <TouchableOpacity onPress={goBack} style={s.backBtn} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color={COLORS.TEXT} />
            </TouchableOpacity>
          ) : <View style={s.backBtn} />}
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
                  <Feather name={icon} size={28} color={COLORS.ACCENT} />
                </View>
                <Text style={s.welcomeTitle}>{title}</Text>
                <Text style={s.welcomeSubtitle}>{subtitle}</Text>

                <View style={s.stepDots}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
                  ))}
                </View>
              </View>

              <View style={s.card}>
                {step === 1 && (
                  <>
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

                    <TouchableOpacity
                      style={[s.primaryBtn, loading && s.btnDisabled]}
                      onPress={handleSendOtp}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGradient}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Send OTP</Text>}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={s.forgotRow}
                      onPress={() => navigation.navigate('ForgotPassword')}
                      activeOpacity={0.7}
                    >
                      <Text style={s.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </>
                )}

                {step === 2 && (
                  <>
                    <OTPInput value={otp} onChange={setOtp} error={otpTimer.expired} />

                    <Text style={[s.expiryText, otpTimer.expired && s.expiryExpired]}>
                      {otpTimer.expired
                        ? 'Code expired — tap Resend to get a new one'
                        : `Code expires in ${formatCountdown(otpTimer.expiresIn)}`}
                    </Text>

                    <TouchableOpacity
                      style={[s.primaryBtn, (loading || otpTimer.expired) && s.btnDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={loading || otpTimer.expired}
                      activeOpacity={0.8}
                    >
                      <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryBtnGradient}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Verify OTP</Text>}
                      </LinearGradient>
                    </TouchableOpacity>

                    <View style={s.otpActions}>
                      {!otpTimer.canResend ? (
                        <Text style={s.timerText}>Resend in {otpTimer.resendIn}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                          <Text style={s.resendText}>{loading ? 'Sending...' : 'Resend OTP'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => { setStep(1); setOtp(''); }}>
                        <Text style={s.changeNumText}>Change number</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {step === 3 && (
                  <>
                    <View style={s.verifiedBadge}>
                      <Feather name="check-circle" size={14} color={COLORS.SUCCESS} />
                      <Text style={s.verifiedText}>Mobile verified</Text>
                    </View>

                    <View style={s.inputWrapper}>
                      <Feather name="lock" size={18} color={COLORS.TEXT_MUTED} />
                      <TextInput
                        style={s.input}
                        placeholder="Enter your password"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={secureText}
                        autoFocus
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
                      onPress={() => navigation.navigate('ForgotPassword')}
                      activeOpacity={0.7}
                    >
                      <Text style={s.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </>
                )}
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

  // Step dots
  stepDots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.BORDER_LIGHT },
  stepDotActive: { width: 24, backgroundColor: COLORS.ACCENT, borderRadius: 4 },
  stepDotDone: { backgroundColor: COLORS.ACCENT },

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

  // Verified badge (step 3)
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginBottom: 16,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: COLORS.SUCCESS_BG, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.SUCCESS,
  },
  verifiedText: { fontFamily: FONTS.family, fontSize: 12, fontWeight: '700', color: COLORS.SUCCESS },

  // Forgot
  forgotRow: { alignSelf: 'center', marginTop: 16 },
  forgotText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.ACCENT },

  // OTP actions
  otpActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14,
  },
  timerText: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  resendText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '700', color: COLORS.ACCENT },
  expiryText: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_SECONDARY, fontWeight: '600', textAlign: 'center', marginTop: 10 },
  expiryExpired: { color: COLORS.LIVE },
  changeNumText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY },


  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  footerText: { fontFamily: FONTS.family, fontSize: 14, color: COLORS.TEXT_SECONDARY },
  signUpText: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.ACCENT },
});

export default LoginScreen;
