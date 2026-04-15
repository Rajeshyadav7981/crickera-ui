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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { COLORS, GRADIENTS } from '../theme';
import Icon from '../components/Icon';
import CalendarPicker from '../components/CalendarPicker';
import { useToast } from '../components/Toast';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const RegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null=unchecked, true/false
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Cricket profile (optional)
  const [showCricketSection, setShowCricketSection] = useState(false);
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD or ''
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [playerRole, setPlayerRole] = useState(''); // batsman | bowler | all_rounder | wicket_keeper
  const [battingStyle, setBattingStyle] = useState(''); // right_hand | left_hand
  const [bowlingStyle, setBowlingStyle] = useState('');
  const usernameDebounceRef = React.useRef(null);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpTimerRef = useRef(null);

  // Countdown timer for resend
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

  // Only allow lowercase letters, numbers, underscores in username
  const handleUsernameChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);
    setUsernameAvailable(null);

    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (clean.length < 3) return;

    setUsernameChecking(true);
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const { usersAPI } = require('../services/api');
        const res = await usersAPI.checkUsername(clean);
        setUsernameAvailable(res.data.available);
      } catch {
        setUsernameAvailable(null);
      }
      setUsernameChecking(false);
    }, 500);
  };

  // Only allow digits in mobile
  const handleMobileChange = (text) => {
    setMobile(text.replace(/[^0-9]/g, ''));
  };

  // Only allow letters and spaces in names
  const handleNameChange = (setter) => (text) => {
    setter(text.replace(/[^a-zA-Z\s]/g, ''));
  };

  const validateEmail = (em) => {
    if (!em) return true; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
  };

  const validatePassword = (pw) => {
    const hasLetter = /[a-zA-Z]/.test(pw);
    const hasNumber = /[0-9]/.test(pw);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
    return { hasLetter, hasNumber, hasSpecial, isValid: hasLetter && hasNumber && hasSpecial && pw.length >= 8 };
  };

  const handleRegister = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const un = username.trim();
    const m = mobile.trim();
    const em = email.trim();
    const pw = password;

    if (!fn || fn.length < 2) {
      toast.warning('First name must be at least 2 characters');
      return;
    }
    if (fn.length > 30) {
      toast.warning('First name must be under 30 characters');
      return;
    }
    if (!ln || ln.length < 1) {
      toast.warning('Last name is required');
      return;
    }
    if (ln.length > 30) {
      toast.warning('Last name must be under 30 characters');
      return;
    }
    if (!un || un.length < 3) {
      toast.warning('Username must be at least 3 characters');
      return;
    }
    if (un.length > 30) {
      toast.warning('Username must be under 30 characters');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(un)) {
      toast.warning('Only lowercase letters, numbers, and underscores');
      return;
    }
    if (usernameAvailable === false) {
      toast.error('Username already taken');
      return;
    }
    if (!m || m.length !== 10 || !/^\d{10}$/.test(m)) {
      toast.warning('Invalid Mobile', 'Enter a valid 10-digit number');
      return;
    }
    if (em && !validateEmail(em)) {
      toast.warning('Invalid Email', 'Enter a valid email (e.g. name@example.com)');
      return;
    }
    const pwCheck = validatePassword(pw);
    if (!pwCheck.isValid) {
      const missing = [];
      if (!pwCheck.hasLetter) missing.push('a letter (a-z)');
      if (!pwCheck.hasNumber) missing.push('a number (0-9)');
      if (!pwCheck.hasSpecial) missing.push('a special character (!@#$...)');
      if (pw.length < 8) missing.push('at least 8 characters');
      toast.warning('Weak Password', missing.join(', '));
      return;
    }
    if (pw.length > 50) {
      toast.warning('Password must be under 50 characters');
      return;
    }
    if (pw !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Send OTP first
    setOtpSending(true);
    try {
      await authAPI.sendOTP(m, 'register');
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
      await authAPI.sendOTP(mobile.trim(), 'register');
      toast.success('OTP Resent', 'New code sent to your phone');
      setOtpTimer(60);
      setOtp('');
    } catch (err) {
      toast.error('Failed', err.response?.data?.detail || 'Could not resend OTP');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    if (otp.length !== 6) {
      toast.warning('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      // Verify OTP
      await authAPI.verifyOTP(mobile.trim(), otp, 'register');
      // Then register — include optional cricket profile
      const cricketProfile = {
        bio: bio.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        date_of_birth: dob || undefined,
        player_role: playerRole || undefined,
        batting_style: battingStyle || undefined,
        bowling_style: bowlingStyle || undefined,
      };
      await register(
        firstName.trim(), lastName.trim(), mobile.trim(),
        email.trim() || undefined, password, username.trim(),
        cricketProfile,
      );
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (err) {
      toast.error('Failed', err.response?.data?.detail || 'Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={GRADIENTS.SCREEN} style={styles.flex}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.BG} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Cricket icon */}
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Icon name="cricket" size={40} color={COLORS.ACCENT} />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the cricket community</Text>

          {/* Dark form card */}
          <Animated.View
            style={[styles.card, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

            {/* First Name */}
            <View style={styles.inputBox}>
              <Feather name="user" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={firstName}
                onChangeText={handleNameChange(setFirstName)}
                maxLength={30}
                autoCapitalize="words"
              />
            </View>

            {/* Last Name */}
            <View style={styles.inputBox}>
              <Feather name="user" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={lastName}
                onChangeText={handleNameChange(setLastName)}
                maxLength={30}
                autoCapitalize="words"
              />
            </View>

            {/* Username (Instagram-style ID) */}
            <View style={[styles.inputBox, usernameAvailable === true && { borderColor: COLORS.SUCCESS_LIGHT }, usernameAvailable === false && { borderColor: COLORS.RED }]}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.ACCENT, marginRight: 2 }}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username (e.g. virat_kohli)"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={username}
                onChangeText={handleUsernameChange}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {usernameChecking && (
                <Feather name="loader" size={14} color={COLORS.TEXT_MUTED} />
              )}
              {!usernameChecking && usernameAvailable === true && (
                <Feather name="check-circle" size={16} color="#22C55E" />
              )}
              {!usernameChecking && usernameAvailable === false && (
                <Feather name="x-circle" size={16} color="#EF4444" />
              )}
            </View>
            {username.length > 0 && username.length < 3 && (
              <Text style={{ fontSize: 11, color: COLORS.TEXT_MUTED, marginTop: -10, marginBottom: 10, marginLeft: 4 }}>
                At least 3 characters
              </Text>
            )}
            {usernameAvailable === false && (
              <Text style={{ fontSize: 11, color: COLORS.RED, marginTop: -10, marginBottom: 10, marginLeft: 4 }}>
                Username already taken — try another
              </Text>
            )}
            {usernameAvailable === true && (
              <Text style={{ fontSize: 11, color: COLORS.SUCCESS_LIGHT, marginTop: -10, marginBottom: 10, marginLeft: 4 }}>
                @{username} is available
              </Text>
            )}

            {/* Mobile */}
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
              />
              {mobile.length > 0 && (
                <Text style={{ fontSize: 11, color: mobile.length === 10 ? COLORS.SUCCESS : COLORS.TEXT_MUTED }}>
                  {mobile.length}/10
                </Text>
              )}
            </View>

            {/* Email */}
            <View style={styles.inputBox}>
              <Feather name="mail" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
              <TextInput
                style={styles.input}
                placeholder="Email (optional)"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={100}
              />
            </View>

            {/* Password */}
            <View style={styles.inputBox}>
              <Feather name="lock" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
              <TextInput
                style={styles.input}
                placeholder="Password (min 8 chars)"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                maxLength={50}
              />
              <TouchableOpacity
                style={styles.visibilityToggle}
                onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={18} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {/* Password strength hints */}
            {password.length > 0 && (
              <View style={styles.pwHints}>
                <Text style={[styles.pwHint, /[a-zA-Z]/.test(password) && styles.pwHintOk]}>
                  {/[a-zA-Z]/.test(password) ? '\u2713' : '\u2022'} Letter (a-z)
                </Text>
                <Text style={[styles.pwHint, /[0-9]/.test(password) && styles.pwHintOk]}>
                  {/[0-9]/.test(password) ? '\u2713' : '\u2022'} Number (0-9)
                </Text>
                <Text style={[styles.pwHint, /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) && styles.pwHintOk]}>
                  {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '\u2713' : '\u2022'} Special char
                </Text>
                <Text style={[styles.pwHint, password.length >= 8 && styles.pwHintOk]}>
                  {password.length >= 8 ? '\u2713' : '\u2022'} 8+ characters
                </Text>
              </View>
            )}

            {/* Confirm Password */}
            <View style={styles.inputBox}>
              <Feather name="lock" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor={COLORS.TEXT_MUTED}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                maxLength={50}
              />
              <TouchableOpacity
                style={styles.visibilityToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={18} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {/* ── Optional cricket profile ── */}
            {!otpStep && (
              <>
                <TouchableOpacity
                  onPress={() => setShowCricketSection(v => !v)}
                  activeOpacity={0.7}
                  style={styles.sectionToggle}
                >
                  <Feather name={showCricketSection ? 'chevron-down' : 'chevron-right'} size={16} color={COLORS.ACCENT} />
                  <Text style={styles.sectionToggleText}>Cricket Profile (optional)</Text>
                  <Text style={styles.sectionToggleHint}>— tell us how you play</Text>
                </TouchableOpacity>

                {showCricketSection && (
                  <View>
                    {/* Role */}
                    <Text style={styles.fieldLabel}>Playing Role</Text>
                    <View style={styles.chipRow}>
                      {[
                        { v: 'batsman', l: 'Batsman' },
                        { v: 'bowler', l: 'Bowler' },
                        { v: 'all_rounder', l: 'All-rounder' },
                        { v: 'wicket_keeper', l: 'Wicket Keeper' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.v}
                          style={[styles.chip, playerRole === opt.v && styles.chipActive]}
                          onPress={() => setPlayerRole(playerRole === opt.v ? '' : opt.v)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, playerRole === opt.v && styles.chipTextActive]}>{opt.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Batting style */}
                    <Text style={styles.fieldLabel}>Batting Style</Text>
                    <View style={styles.chipRow}>
                      {[
                        { v: 'right_hand', l: 'Right Hand' },
                        { v: 'left_hand', l: 'Left Hand' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.v}
                          style={[styles.chip, battingStyle === opt.v && styles.chipActive]}
                          onPress={() => setBattingStyle(battingStyle === opt.v ? '' : opt.v)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, battingStyle === opt.v && styles.chipTextActive]}>{opt.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Bowling style */}
                    <Text style={styles.fieldLabel}>Bowling Style</Text>
                    <View style={styles.chipRow}>
                      {[
                        { v: 'right_arm_fast', l: 'RA Fast' },
                        { v: 'right_arm_medium', l: 'RA Medium' },
                        { v: 'right_arm_spin', l: 'RA Spin' },
                        { v: 'left_arm_fast', l: 'LA Fast' },
                        { v: 'left_arm_medium', l: 'LA Medium' },
                        { v: 'left_arm_spin', l: 'LA Spin' },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.v}
                          style={[styles.chip, bowlingStyle === opt.v && styles.chipActive]}
                          onPress={() => setBowlingStyle(bowlingStyle === opt.v ? '' : opt.v)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.chipText, bowlingStyle === opt.v && styles.chipTextActive]}>{opt.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* City */}
                    <View style={[styles.inputBox, { marginTop: 6 }]}>
                      <Feather name="map-pin" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                      <TextInput
                        style={styles.input}
                        placeholder="City"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        value={city}
                        onChangeText={setCity}
                        maxLength={100}
                      />
                    </View>

                    {/* Country */}
                    <View style={styles.inputBox}>
                      <Feather name="globe" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                      <TextInput
                        style={styles.input}
                        placeholder="Country"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        value={country}
                        onChangeText={setCountry}
                        maxLength={100}
                      />
                    </View>

                    {/* Bio */}
                    <View style={[styles.inputBox, { height: 80, alignItems: 'flex-start', paddingVertical: 10 }]}>
                      <Feather name="edit-3" size={16} color={COLORS.TEXT_MUTED} style={[styles.inputIconStyle, { marginTop: 2 }]} />
                      <TextInput
                        style={[styles.input, { textAlignVertical: 'top' }]}
                        placeholder="Short bio (favorite format, team, etc.)"
                        placeholderTextColor={COLORS.TEXT_MUTED}
                        value={bio}
                        onChangeText={setBio}
                        multiline
                        maxLength={300}
                      />
                    </View>

                    {/* Date of Birth */}
                    <TouchableOpacity
                      style={styles.inputBox}
                      onPress={() => setShowDobPicker(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="calendar" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
                      <Text style={[styles.input, { lineHeight: 52 }, !dob && { color: COLORS.TEXT_MUTED }]}>
                        {dob
                          ? (() => {
                              const [y, m, d] = dob.split('-').map(Number);
                              return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                            })()
                          : 'Date of birth'}
                      </Text>
                    </TouchableOpacity>
                    <CalendarPicker
                      visible={showDobPicker}
                      onClose={() => setShowDobPicker(false)}
                      value={dob}
                      onSelect={setDob}
                      minDate="1950-01-01"
                      maxDate={new Date()}
                    />
                  </View>
                )}
              </>
            )}

            {/* OTP Verification Step */}
            {otpStep ? (
              <View style={styles.otpSection}>
                <View style={styles.otpHeader}>
                  <Feather name="shield" size={20} color={COLORS.ACCENT} />
                  <Text style={styles.otpTitle}>Verify your number</Text>
                </View>
                <Text style={styles.otpSubtitle}>Enter the 6-digit code sent to {mobile}</Text>
                <View style={styles.inputBox}>
                  <Feather name="hash" size={16} color={COLORS.TEXT_MUTED} style={styles.inputIconStyle} />
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
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyAndRegister}
                  disabled={loading}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={GRADIENTS.BUTTON}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}>
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Verify & Create Account</Text>
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
              /* Create Account Button — sends OTP */
              <TouchableOpacity
                style={[styles.button, (loading || otpSending) && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading || otpSending}
                activeOpacity={0.8}>
                <LinearGradient
                  colors={GRADIENTS.BUTTON}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}>
                  {otpSending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Or continue with divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialLabel}>Google</Text>
            </TouchableOpacity>
            <View style={{ width: 12 }} />
            <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
              <Text style={styles.socialIcon}>{'\uF8FF'}</Text>
              <Text style={styles.socialLabel}>Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.footerContainer}>
            <Text style={styles.footerText}>
              Already have an account? <Text style={styles.footerLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  cricketIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    marginBottom: 14,
    paddingHorizontal: 14,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  inputIconStyle: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT,
    height: '100%',
    paddingVertical: 0,
  },
  visibilityToggle: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  pwHints: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: -6, paddingHorizontal: 4,
  },
  pwHint: { fontSize: 11, color: COLORS.TEXT_MUTED, fontWeight: '500' },
  pwHintOk: { color: COLORS.SUCCESS },
  visibilityIcon: {
    fontSize: 18,
    color: COLORS.TEXT_MUTED,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    fontSize: 13,
    color: COLORS.TEXT_MUTED,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  socialIcon: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 8,
    color: COLORS.TEXT,
  },
  socialLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  footerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  footerLink: {
    color: COLORS.ACCENT,
    fontWeight: '700',
  },
  otpSection: {
    marginTop: 8,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  otpTitle: {
    fontSize: 16,
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
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  sectionToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ACCENT,
  },
  sectionToggleHint: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.ACCENT_SOFT,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  chipTextActive: {
    color: COLORS.ACCENT,
  },
});

export default RegisterScreen;
