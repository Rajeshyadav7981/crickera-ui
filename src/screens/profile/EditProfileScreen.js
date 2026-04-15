import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { authAPI } from '../../services/api';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import CalendarPicker from '../../components/CalendarPicker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const getProfileImageUrl = (profile) => {
  if (!profile) return null;
  if (profile.startsWith('http')) return profile;
  // Local backend path — need to import API base dynamically
  try {
    const api = require('../services/api').default;
    return `${api.defaults.baseURL}${profile}`;
  } catch {
    return profile;
  }
};

const EditProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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

  const formatDobDisplay = (iso) => {
    if (!iso) return 'Select date of birth';
    try {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return iso; }
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }
    setSaving(true);
    try {
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
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (source) => {
    let result;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Gallery permission is required to select a photo.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
    }

    if (!result.canceled && result.assets?.[0]?.uri) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    setUploading(true);
    try {
      const res = await authAPI.uploadProfilePhoto(uri);
      setProfileImage(res.data.profile);
      await refreshUser();
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Failed to upload photo';
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const showImageOptions = () => {
    Alert.alert('Change Profile Photo', 'Choose an option', [
      { text: 'Take Photo', onPress: () => pickImage('camera') },
      { text: 'Choose from Gallery', onPress: () => pickImage('gallery') },
      ...(profileImage ? [{ text: 'Remove Photo', style: 'destructive', onPress: removePhoto }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removePhoto = async () => {
    setUploading(true);
    try {
      await updateUser({ profile: '' });
      setProfileImage(null);
    } catch (e) {
      Alert.alert('Error', 'Failed to remove photo');
    } finally {
      setUploading(false);
    }
  };

  const initials = `${firstName?.charAt(0)?.toUpperCase() || ''}${lastName?.charAt(0)?.toUpperCase() || ''}`;
  const imageUrl = getProfileImageUrl(profileImage);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar with edit option */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={showImageOptions} activeOpacity={0.7} disabled={uploading}>
              <View style={styles.avatarOuter}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                {uploading ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                ) : (
                  <View style={styles.cameraBadge}>
                    <Feather name="camera" size={12} color="#fff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Tap to change photo</Text>
          </View>

          {/* Username (read-only — change via Settings) */}
          <Text style={styles.label}>Username</Text>
          <View style={[styles.inputWrap, styles.inputDisabled]}>
            <Text style={styles.disabledText}>@{user?.username || 'not set'}</Text>
          </View>

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
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  content: { padding: 20, paddingBottom: 40 },

  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatarOuter: { position: 'relative' },
  avatar: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.ACCENT,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImage: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.ACCENT,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
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
  cameraBadgeText: { fontSize: 14 },
  changePhotoText: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 8 },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 6, marginTop: 16 },
  inputWrap: {
    backgroundColor: COLORS.SURFACE, borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputDisabled: { backgroundColor: COLORS.CARD },
  disabledText: { fontSize: 15, color: COLORS.TEXT_MUTED },
  input: { fontSize: 15, color: COLORS.TEXT },

  saveBtn: {
    backgroundColor: COLORS.ACCENT, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 32,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionDivider: {
    marginTop: 28, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: COLORS.BORDER,
    paddingTop: 20,
  },
  sectionHead: {
    fontSize: 15, fontWeight: '800', color: COLORS.TEXT, letterSpacing: -0.2,
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
    fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY,
  },
  chipTextActive: {
    color: COLORS.ACCENT,
  },
});

export default EditProfileScreen;
