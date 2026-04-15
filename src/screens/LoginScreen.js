import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { useToast } from '../components/Toast';
import { COLORS, GRADIENTS } from '../theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const toast = useToast();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpTimerRef = useRef(null);

  useEffect(() => {
    if (otpTimer > 0) {
      otpTimerRef.current = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
    }
    return () => clearTimeout(otpTimerRef.current);
  }, [otpTimer]);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Only allow digits in mobile
  const handleMobileChange = (text) => {
    setMobile(text.replace(/[^0-9]/g, ''));
  };

  const handleLogin = async () => {
    const m = mobile.trim();
    if (!m || m.length !== 10 || !/^\d{10}$/.test(m)) {
      toast.warning('Invalid Mobile', 'Enter a valid 10-digit mobile number');
      return;
    }
    if (!password.trim()) {
      toast.warning('Please enter your password');
      return;
    }
    // Send OTP
    setOtpSending(true);
    try {
      await authAPI.sendOTP(m, 'login');
      toast.success('OTP Sent', 'Check your phone for the verification code');
      setOtpStep(true);
      setOtpTimer(60);
    } catch (err) {
      toast.error('OTP Failed', err.response?.data?.detail || 'Could not send OTP. Try again.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleResendOTP = async () => {
    if (otpTimer > 0) return;
    setOtpSending(true);
    try {
      await authAPI.sendOTP(mobile.trim(), 'login');
      toast.success('OTP Resent', 'New code sent to your phone');
      setOtpTimer(60);
      setOtp('');
    } catch (err) {
      toast.error('Failed', err.response?.data?.detail || 'Could not resend OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyAndLogin = async () => {
    if (otp.length !== 6) {
      toast.warning('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await authAPI.verifyOTP(mobile.trim(), otp, 'login');
      await login(mobile.trim(), password);
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    } catch (err) {
      toast.error('Login Failed', err.response?.data?.detail || 'Invalid credentials or OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Skip to browse as guest */}
            <View style={styles.skipRow}>
              <TouchableOpacity
                onPress={() => {
                  if (navigation.canGoBack()) navigation.goBack();
                  else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                }}
                activeOpacity={0.7}
                style={styles.skipBtn}
              >
                <Text style={styles.skipText}>Skip</Text>
                <Feather name="arrow-right" size={14} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[
                styles.content,
                { opacity: fadeIn, transform: [{ translateY: slideUp }] },
              ]}>

              {/* Icon & Title */}
              <View style={styles.headerSection}>
                <View style={styles.iconCircle}>
                  <MaterialCommunityIcons name="cricket" size={34} color={COLORS.ACCENT_LIGHT} />
                </View>
                <Text style={styles.welcomeTitle}>Welcome Back</Text>
                <Text style={styles.welcomeSubtitle}>
                  Sign in to your cricket account
                </Text>
              </View>

              {/* Form Card */}
              <View style={styles.card}>
                {/* Mobile Input */}
                <View style={styles.inputWrapper}>
                  <Feather name="phone" size={20} color={COLORS.TEXT_MUTED} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter mobile number"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    value={mobile}
                    onChangeText={handleMobileChange}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputWrapper}>
                  <Feather name="lock" size={20} color={COLORS.TEXT_MUTED} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter password"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={secureText}
                  />
                  <TouchableOpacity
                    onPress={() => setSecureText(!secureText)}
                    activeOpacity={0.7}
                    style={styles.eyeButton}>
                    <Feather name={secureText ? "eye-off" : "eye"} size={18} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity
                  style={styles.forgotRow}
                  activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>

                {otpStep ? (
                  /* OTP Verification Step */
                  <View>
                    <View style={styles.otpHeader}>
                      <Feather name="shield" size={18} color={COLORS.ACCENT} />
                      <Text style={styles.otpTitle}>Verify your number</Text>
                    </View>
                    <Text style={styles.otpSubtitle}>Enter the 6-digit code sent to {mobile}</Text>
                    <View style={styles.inputWrapper}>
                      <Feather name="hash" size={20} color={COLORS.TEXT_MUTED} />
                      <TextInput
                        style={[styles.input, { letterSpacing: 8, fontSize: 20, fontWeight: '700', textAlign: 'center' }]}
                        placeholder="000000"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        value={otp}
                        onChangeText={(t) => setOtp(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.signInButton, loading && styles.buttonDisabled]}
                      onPress={handleVerifyAndLogin}
                      disabled={loading}
                      activeOpacity={0.8}>
                      <LinearGradient
                        colors={GRADIENTS.BUTTON}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.signInButtonGradient}>
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.signInButtonText}>Verify & Sign In</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    <View style={styles.otpResendRow}>
                      {otpTimer > 0 ? (
                        <Text style={styles.otpTimerText}>Resend in {otpTimer}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendOTP} disabled={otpSending}>
                          <Text style={styles.otpResendText}>{otpSending ? 'Sending...' : 'Resend OTP'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => { setOtpStep(false); setOtp(''); }}>
                        <Text style={styles.otpChangeText}>Change number</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Sign In Button — sends OTP */
                  <TouchableOpacity
                    style={[styles.signInButton, (loading || otpSending) && styles.buttonDisabled]}
                    onPress={handleLogin}
                    disabled={loading || otpSending}
                    activeOpacity={0.8}>
                    <LinearGradient
                      colors={GRADIENTS.BUTTON}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.signInButtonGradient}>
                      {otpSending ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.signInButtonText}>Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Divider */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social Buttons */}
                <View style={styles.socialRow}>
                  <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                    <Text style={styles.socialIcon}>G</Text>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                    <Text style={styles.socialIcon}>{'\uF8FF'}</Text>
                    <Text style={styles.socialButtonText}>Apple</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Don't have an account?{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Register')}
                  activeOpacity={0.7}>
                  <Text style={styles.signUpText}>Sign Up</Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 4,
    marginBottom: 6,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  content: {
    alignItems: 'center',
  },

  /* Header / Icon Section */
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 34,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Card */
  card: {
    width: '100%',
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },

  /* Inputs */
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  inputIcon: {
    fontSize: 20,
    color: COLORS.TEXT_MUTED,
    marginRight: 10,
    width: 24,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT,
    height: '100%',
  },
  eyeButton: {
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 20,
    color: COLORS.TEXT_MUTED,
  },

  /* Forgot Password */
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ACCENT,
  },

  /* Sign In Button */
  signInButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonGradient: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Divider */
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    color: COLORS.TEXT_MUTED,
    marginHorizontal: 14,
    fontSize: 13,
    fontWeight: '500',
  },

  /* Social Buttons */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SURFACE,
    gap: 8,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ACCENT,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  otpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  otpSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 14,
  },
  otpResendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  otpTimerText: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
    fontWeight: '500',
  },
  otpResendText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ACCENT,
  },
  otpChangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
});

export default LoginScreen;
