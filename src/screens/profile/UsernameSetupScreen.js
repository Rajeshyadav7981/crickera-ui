import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usersAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, GRADIENTS } from '../../theme';

const UsernameSetupScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null); // null = not checked, true/false
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  // Auto-suggest from name
  useEffect(() => {
    if (user?.first_name) {
      const suggestion = user.first_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + (user.id || '');
      setUsername(suggestion);
    }
  }, [user]);

  const handleChange = (text) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9._]/g, '');
    setUsername(clean);
    setAvailable(null);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (clean.length < 3) {
      setError(clean.length > 0 ? 'At least 3 characters' : '');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await usersAPI.checkUsername(clean);
        setAvailable(res.data.available);
        if (!res.data.available) setError(res.data.reason || 'Already taken');
      } catch {
        setError('Could not check');
      }
      setChecking(false);
    }, 500);
  };

  const handleSave = async () => {
    if (!available || saving) return;
    setSaving(true);
    try {
      await usersAPI.setUsername(username);
      await refreshUser?.();
      navigation.goBack();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to set username');
    }
    setSaving(false);
  };

  const statusIcon = checking ? null : available === true ? 'check-circle' : available === false ? 'close-circle' : null;
  const statusColor = available === true ? COLORS.SUCCESS_LIGHT : COLORS.RED;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { paddingTop: insets.top + 20 }]}
    >
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="at" size={40} color={COLORS.ACCENT} />
        </View>

        <Text style={styles.title}>Choose your username</Text>
        <Text style={styles.subtitle}>
          This is how others will find and tag you in posts and comments
        </Text>

        {/* Input */}
        <View style={styles.inputRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={handleChange}
            placeholder="username"
            placeholderTextColor={COLORS.TEXT_MUTED}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            autoFocus
          />
          {checking && <ActivityIndicator size="small" color={COLORS.ACCENT} />}
          {statusIcon && (
            <MaterialCommunityIcons name={statusIcon} size={20} color={statusColor} />
          )}
        </View>

        {/* Status message */}
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : available === true ? (
          <Text style={styles.successText}>@{username} is available!</Text>
        ) : (
          <Text style={styles.hintText}>Lowercase letters, numbers, periods, underscores</Text>
        )}

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, (!available || saving) && { opacity: 0.4 }]}
          onPress={handleSave}
          disabled={!available || saving}
          activeOpacity={0.8}
        >
          <LinearGradient colors={GRADIENTS.BUTTON} style={styles.saveBtnGrad}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Set Username'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  content: { paddingHorizontal: 28, alignItems: 'center' },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.TEXT, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 20, marginBottom: 32 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: COLORS.SURFACE, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.BORDER,
    paddingHorizontal: 16, height: 52, gap: 4,
  },
  atSign: { fontSize: 18, fontWeight: '700', color: COLORS.ACCENT },
  input: { flex: 1, fontSize: 16, color: COLORS.TEXT, height: 52 },

  errorText: { color: COLORS.RED, fontSize: 12, fontWeight: '600', marginTop: 8, alignSelf: 'flex-start' },
  successText: { color: COLORS.SUCCESS_LIGHT, fontSize: 12, fontWeight: '600', marginTop: 8, alignSelf: 'flex-start' },
  hintText: { color: COLORS.TEXT_MUTED, fontSize: 12, marginTop: 8, alignSelf: 'flex-start' },

  saveBtn: { width: '100%', borderRadius: 14, overflow: 'hidden', marginTop: 28 },
  saveBtnGrad: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  skipBtn: { marginTop: 16 },
  skipText: { color: COLORS.TEXT_MUTED, fontSize: 14, fontWeight: '600' },
});

export default UsernameSetupScreen;
