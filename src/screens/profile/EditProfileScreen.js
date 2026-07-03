import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { usersAPI } from '../../services/api';
import { COLORS, FONTS } from '../../theme';
import { PROFILE_AVATARS } from '../../constants/avatars';
import Avatar from '../../components/Avatar';
import BackButton from '../../components/BackButton';
import CalendarPicker from '../../components/CalendarPicker';
import { useToast } from '../../components/Toast';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  useAuthGate('edit your profile');
  const { user, updateUser, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [dob, setDob] = useState(user?.date_of_birth || ''); // ISO yyyy-mm-dd
  const [battingStyle, setBattingStyle] = useState(user?.batting_style || '');
  const [bowlingStyle, setBowlingStyle] = useState(user?.bowling_style || '');
  const [playerRole, setPlayerRole] = useState(user?.player_role || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [profileImage, setProfileImage] = useState(user?.profile || null);

  // Username (editable, with debounced availability check)
  const originalUsername = (user?.username || '').toLowerCase();
  const [username, setUsername] = useState(originalUsername);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null); // null = unchanged/unchecked
  const [usernameError, setUsernameError] = useState('');
  const usernameDebounce = useRef(null);

  useEffect(() => () => clearTimeout(usernameDebounce.current), []);

  const usernameChanged = username !== originalUsername;

  const handleUsernameChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);
    setUsername(clean);
    setUsernameAvailable(null);
    setUsernameError('');
    if (usernameDebounce.current) clearTimeout(usernameDebounce.current);

    if (clean === originalUsername) return; // back to current handle — nothing to check
    if (clean.length < 3) {
      setUsernameError(clean.length > 0 ? 'At least 3 characters' : '');
      return;
    }

    usernameDebounce.current = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await usersAPI.checkUsername(clean);
        setUsernameAvailable(res.data.available);
        if (!res.data.available) setUsernameError(res.data.reason || 'Already taken');
      } catch {
        setUsernameError('Could not check availability');
      } finally {
        setCheckingUsername(false);
      }
    }, 500);
  };

  const formatDobDisplay = (iso) => {
    if (!iso) return 'Select date of birth';
    try {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and last name are required');
      return;
    }
    if (usernameChanged) {
      if (username.length < 3) {
        toast.error('Username must be at least 3 characters');
        return;
      }
      if (usernameAvailable === false) {
        toast.error('That username is already taken. Choose another.');
        return;
      }
    }
    setSaving(true);
    try {
      // Username goes through its own endpoint (uniqueness + validation).
      if (usernameChanged) {
        await usersAPI.setUsername(username);
      }
      await updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || null,
        bio: bio.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        date_of_birth: dob || null,
        batting_style: battingStyle || null,
        bowling_style: bowlingStyle || null,
        player_role: playerRole || null,
      });
      toast.success('Profile updated successfully');
      navigation.goBack();
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Pick a preset avatar — saved as a short key in `profile`, no upload.
  const selectAvatar = async (key) => {
    const next = profileImage === key ? '' : key;
    setUploading(true);
    try {
      await updateUser({ profile: next });
      setProfileImage(next || null);
    } catch (e) {
      toast.error('Failed to update avatar');
    } finally {
      setUploading(false);
    }
  };

  const initials = `${firstName?.charAt(0)?.toUpperCase() || ''}${lastName?.charAt(0)?.toUpperCase() || ''}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={40}
      >
          {/* Avatar — pick from preset avatars (no upload) */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarPreview}>
              <Avatar uri={profileImage} name={`${firstName} ${lastName}`} size={100} />
              {uploading && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
            </View>
            <Text style={styles.changePhotoText}>Choose your avatar</Text>
            <View style={styles.avatarGrid}>
              {PROFILE_AVATARS.map((a) => {
                const selected = profileImage === a.key;
                return (
                  <TouchableOpacity
                    key={a.key}
                    activeOpacity={0.85}
                    disabled={uploading}
                    onPress={() => selectAvatar(a.key)}
                  >
                    <LinearGradient
                      colors={a.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.avatarTile, selected && styles.avatarTileSelected]}
                    >
                      {a.emoji ? (
                        <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                      ) : (
                        <MaterialCommunityIcons name={a.icon} size={28} color="#fff" />
                      )}
                    </LinearGradient>
                    {selected && (
                      <View style={styles.tileCheck}>
                        <Feather name="check" size={11} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Username (editable, with live availability check) */}
          <Text style={styles.label}>Username</Text>
          <View style={[
            styles.inputWrap,
            { flexDirection: 'row', alignItems: 'center' },
            usernameChanged && usernameAvailable === true && styles.inputWrapValid,
            usernameChanged && usernameAvailable === false && styles.inputWrapInvalid,
          ]}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={username}
              onChangeText={handleUsernameChange}
              placeholder="username"
              placeholderTextColor={COLORS.TEXT_MUTED}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {checkingUsername ? (
              <ActivityIndicator size="small" color={COLORS.ACCENT} />
            ) : usernameChanged && usernameAvailable === true ? (
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.SUCCESS} />
            ) : usernameChanged && usernameAvailable === false ? (
              <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.DANGER} />
            ) : null}
          </View>
          {usernameChanged && usernameAvailable === true ? (
            <Text style={styles.usernameOk}>@{username} is available</Text>
          ) : usernameError ? (
            <Text style={styles.usernameBad}>{usernameError}</Text>
          ) : null}

          {/* Mobile (read-only) */}
          <Text style={styles.label}>Mobile</Text>
          <View style={[styles.inputWrap, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{user?.mobile}</Text>
          </View>

          {/* First Name */}
          <Text style={styles.label}>First Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
          </View>

          {/* Last Name */}
          <Text style={styles.label}>Last Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email (optional)"
              placeholderTextColor={COLORS.TEXT_MUTED}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* ── Cricket Profile section ── */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionHead}>Cricket Profile</Text>
          </View>

          {/* Bio */}
          <Text style={styles.label}>Bio</Text>
          <View style={[styles.inputWrap, { minHeight: 80 }]}>
            <TextInput
              style={[styles.input, { textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell others about your cricket journey..."
              placeholderTextColor={COLORS.TEXT_MUTED}
              multiline
              maxLength={300}
            />
          </View>

          {/* Playing Role */}
          <Text style={styles.label}>Playing Role</Text>
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

          {/* Batting Style */}
          <Text style={styles.label}>Batting Style</Text>
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

          {/* Bowling Style */}
          <Text style={styles.label}>Bowling Style</Text>
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
          <Text style={styles.label}>City</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Your city"
              placeholderTextColor={COLORS.TEXT_MUTED}
              maxLength={100}
            />
          </View>

          {/* Country */}
          <Text style={styles.label}>Country</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={setCountry}
              placeholder="Your country"
              placeholderTextColor={COLORS.TEXT_MUTED}
              maxLength={100}
            />
          </View>

          {/* Date of Birth */}
          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity
            style={[styles.inputWrap, { flexDirection: 'row', alignItems: 'center' }]}
            onPress={() => setShowDobPicker(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="calendar" size={16} color={COLORS.TEXT_MUTED} style={{ marginRight: 10 }} />
            <Text style={[styles.input, !dob && { color: COLORS.TEXT_MUTED }]}>
              {formatDobDisplay(dob)}
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

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.BG,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontFamily: FONTS.family, fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitle: { fontFamily: FONTS.family, fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  content: { padding: 20, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatarPreview: { width: 100, height: 100 },
  avatarGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 14, marginTop: 16, maxWidth: 344, alignSelf: 'center',
  },
  avatarTile: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  avatarTileSelected: { borderColor: COLORS.TEXT },
  tileCheck: {
    position: 'absolute', top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.ACCENT,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.BG,
  },
  avatarOuter: { position: 'relative' },
  avatar: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.ACCENT,
  },
  avatarText: { fontFamily: FONTS.family, color: '#fff', fontSize: 32, fontWeight: '700' },
  avatarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.ACCENT,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cameraBadgeText: { fontFamily: FONTS.family, fontSize: 14 },
  changePhotoText: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 8 },

  label: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 6, marginTop: 16 },
  inputWrap: {
    backgroundColor: COLORS.SURFACE, borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputDisabled: { backgroundColor: COLORS.CARD },
  inputWrapValid: { borderColor: COLORS.SUCCESS },
  inputWrapInvalid: { borderColor: COLORS.DANGER },
  disabledText: { fontFamily: FONTS.family, fontSize: 15, color: COLORS.TEXT_MUTED },
  input: { fontFamily: FONTS.family, fontSize: 15, color: COLORS.TEXT },
  atSign: { fontFamily: FONTS.family, fontSize: 15, color: COLORS.TEXT_MUTED, marginRight: 2 },
  usernameOk: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.SUCCESS, marginTop: 6, fontWeight: '600' },
  usernameBad: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.DANGER, marginTop: 6, fontWeight: '600' },

  saveBtn: {
    backgroundColor: COLORS.ACCENT, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: FONTS.family, color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionDivider: {
    marginTop: 28, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: COLORS.BORDER,
    paddingTop: 20,
  },
  sectionHead: {
    fontFamily: FONTS.family,    fontSize: 15, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.2,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.ACCENT_SOFT, borderColor: COLORS.ACCENT_SOFT_BORDER,
  },
  chipText: {
    fontFamily: FONTS.family,    fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY,
  },
  chipTextActive: {
    color: COLORS.ACCENT,
  },
});

export default EditProfileScreen;
