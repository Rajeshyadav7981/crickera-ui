import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator,
  Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COLORS, GRADIENTS, FONTS } from '../theme';
import BackButton from '../components/BackButton';
import OTPInput from '../components/OTPInput';
import { useToast } from '../components/Toast';
import { Feather } from '@expo/vector-icons';

const ForgotPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const toast = useToast();

  // 3 steps: 1 = mobile, 2 = OTP, 3 = new password
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpTimerRef = useRef(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (otpTimer > 0) {
      otpTimerRef.current = setTimeout(() => setOtpTimer((t) => t - 1), 1000);
    }
    return () => clearTimeout(otpTimerRef.current);
  }, [otpTimer]);

  const handleMobileChange = (text) => setMobile(text.replace(/[^0-9]/g, ''));

  const validatePassword = (pw) => {
    const hasLetter = /[a-zA-Z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
    return { hasLetter, hasNumber, hasSpecial, isValid: hasLetter && hasNumber && hasSpecial && pw.length >= 8 };
  };

  // Step 1 → Step 2: send OTP
  const handleSendOtp = async () => {
    if (mobile.length !== 10) {
      toast.warning('Enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await authAPI.sendOTP(mobile, 'reset_password');
      toast.success('OTP Sent', 'Check your phone for the verification code');
      setStep(2);
      setOtpTimer(60);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to send OTP';
      toast.error('Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0 || loading) return;
    setLoading(true);
    try {
      await authAPI.sendOTP(mobile, 'reset_password');
      toast.success('OTP Resent', 'New code sent to your phone');
      setOtpTimer(60);
      setOtp('');
    } catch (err) {
      toast.error('Failed', err.response?.data?.detail || 'Could not resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3: just advance
  const handleOtpNext = () => {
    if (otp.length !== 6) {
      toast.warning('Enter the 6-digit OTP');
      return;
    }
    setStep(3);
  };

  // Step 3: submit new password
  const handleResetPassword = async () => {
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.isValid) {
      const missing = [];
      if (!pwCheck.hasLetter) missing.push('a letter (a-z)');
      if (!pwCheck.hasNumber) missing.push('a number (0-9)');
      if (!pwCheck.hasSpecial) missing.push('a special character (!@#$...)');
      if (newPassword.length < 8) missing.push('at least 8 characters');
      toast.warning('Weak Password', missing.join(', '));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(mobile, otp, newPassword);
      // Auto-login with new password → go straight to home
      await login(mobile, newPassword);
      toast.success('Password Reset', 'Welcome back!');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err) {
      toast.error('Reset Failed', err.response?.data?.detail || 'Try again');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    1: { title: 'Forgot Password?', subtitle: 'Enter your mobile to reset your password' },
    2: { title: 'Verify OTP', subtitle: `Enter the 6-digit code sent to ${mobile}` },
    3: { title: 'Set New Password', subtitle: 'Choose a strong password for your account' },
  };

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={styles.flex}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />
      <View style={[styles.headerBar, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={() => (step === 1 ? navigation.goBack() : setStep(step - 1))} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={40}
      >
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={styles.iconCircle}>
              <Feather name={step === 1 ? 'lock' : step === 2 ? 'shield' : 'key'} size={22} color={COLORS.ACCENT} />
            </View>
          </View>

          <Text style={styles.title}>{titles[step].title}</Text>
          <Text style={styles.subtitle}>{titles[step].subtitle}</Text>

          <Animated.View style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            {step === 1 && (
              <>
                <View style={styles.inputBox}>
                  <Feather name="phone" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                  <TextInput
                    style={styles.input}
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
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {step === 2 && (
              <>
                <OTPInput value={otp} onChange={setOtp} />
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleOtpNext}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                    <Text style={styles.buttonText}>Next</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <View style={styles.resendRow}>
                  {otpTimer > 0 ? (
                    <Text style={styles.timerText}>Resend in {otpTimer}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                      <Text style={styles.resendText}>{loading ? 'Sending...' : 'Resend OTP'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <View style={styles.inputBox}>
                  <Feather name="lock" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                  <TextInput
                    style={styles.input}
                    placeholder="New password (min 8 chars)"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showPassword}
                    maxLength={50}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.visibilityToggle} onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>

                {newPassword.length > 0 && (
                  <View style={styles.pwHints}>
                    <Text style={[styles.pwHint, /[a-zA-Z]/.test(newPassword) && styles.pwHintOk]}>
                      {/[a-zA-Z]/.test(newPassword) ? '\u2713' : '\u2022'} Letter
                    </Text>
                    <Text style={[styles.pwHint, /[0-9]/.test(newPassword) && styles.pwHintOk]}>
                      {/[0-9]/.test(newPassword) ? '\u2713' : '\u2022'} Number
                    </Text>
                    <Text style={[styles.pwHint, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) && styles.pwHintOk]}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? '\u2713' : '\u2022'} Special
                    </Text>
                    <Text style={[styles.pwHint, newPassword.length >= 8 && styles.pwHintOk]}>
                      {newPassword.length >= 8 ? '\u2713' : '\u2022'} 8+ chars
                    </Text>
                  </View>
                )}

                <View style={styles.inputBox}>
                  <Feather name="lock" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm new password"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    maxLength={50}
                  />
                  <TouchableOpacity style={styles.visibilityToggle} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Feather name={showConfirmPassword ? 'eye' : 'eye-off'} size={18} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={GRADIENTS.BUTTON} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
      </KeyboardAwareScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBar: { paddingHorizontal: 12, paddingBottom: 8 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 16 },

  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontFamily: FONTS.family, fontSize: 24, fontWeight: '800', color: COLORS.TEXT, textAlign: 'center' },
  subtitle: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_SECONDARY, textAlign: 'center', marginTop: 6, marginBottom: 24, paddingHorizontal: 8 },

  card: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: COLORS.BORDER,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE, marginBottom: 14, paddingHorizontal: 14,
  },
  inputIconStyle: { marginRight: 12, width: 24, textAlign: 'center' },
  input: { fontFamily: FONTS.family, flex: 1, fontSize: 15, color: COLORS.TEXT, height: '100%', paddingVertical: 0 },
  visibilityToggle: { paddingLeft: 8, paddingVertical: 4 },

  button: {
    borderRadius: 12, overflow: 'hidden', marginTop: 6,
    shadowColor: COLORS.ACCENT, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  buttonGradient: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: FONTS.family, color: '#fff', fontSize: 16, fontWeight: '700' },

  pwHints: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: -6, paddingHorizontal: 4 },
  pwHint: { fontFamily: FONTS.family, fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  pwHintOk: { color: COLORS.SUCCESS },

  resendRow: { alignItems: 'center', marginTop: 14 },
  timerText: { fontFamily: FONTS.family, fontSize: 13, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  resendText: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '700', color: COLORS.ACCENT },
});

export default ForgotPasswordScreen;
