import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useThemeContext } from '../../context/ThemeContext';
import { COLORS, FONTS } from '../../theme';
import { authAPI } from '../../services/api';
import BackButton from '../../components/BackButton';
import { useToast } from '../../components/Toast';
import { isHapticsEnabled, setHapticsEnabled, initHaptics } from '../../utils/haptics';

// TODO: swap these for the final hosted policy URLs before Play Store submission.
const PRIVACY_POLICY_URL = 'https://crixone.in/privacy';
const TERMS_URL = 'https://crixone.in/terms';
const APP_VERSION = Constants.expoConfig?.version || '1.0.1';

const SettingsScreen = ({ navigation }) => {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { colors: C } = useThemeContext();
  const [hapticsOn, setHapticsOn] = useState(isHapticsEnabled());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { initHaptics().then(setHapticsOn); }, []);
  const toggleHaptics = (v) => { setHapticsOn(v); setHapticsEnabled(v); };

  const handleDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account and personal data. Matches you scored stay on record but are no longer linked to you. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await authAPI.deleteAccount();
              await logout();
            } catch (e) {
              setDeleting(false);
              toast.error(e?.response?.data?.detail || 'Something went wrong. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: C.BG }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.CARD, borderBottomColor: C.BORDER }]}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={[styles.headerTitle, { color: C.TEXT }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Effects Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Effects</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.TEXT }]}>Haptic Feedback</Text>
              <Text style={[styles.settingDesc, { color: C.TEXT_SECONDARY }]}>Vibrate on six, four, wicket & win while scoring</Text>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={toggleHaptics}
              trackColor={{ false: C.SURFACE, true: C.ACCENT + '66' }}
              thumbColor={hapticsOn ? C.ACCENT : C.TEXT_MUTED}
            />
          </View>
        </View>

        {/* App Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>App</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: C.TEXT }]}>App Version</Text>
            <Text style={[styles.settingValue, { color: C.TEXT_SECONDARY }]}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* Legal Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Legal</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <Text style={[styles.settingTitle, { color: C.TEXT }]}>Privacy Policy</Text>
            <Text style={[styles.settingValue, { color: C.TEXT_SECONDARY }]}>›</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: C.BORDER }]} />
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => Linking.openURL(TERMS_URL)}
          >
            <Text style={[styles.settingTitle, { color: C.TEXT }]}>Terms of Service</Text>
            <Text style={[styles.settingValue, { color: C.TEXT_SECONDARY }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <TouchableOpacity style={styles.settingRow} onPress={logout}>
            <Text style={[styles.settingTitle, { color: C.ACCENT }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: C.BORDER }]} />
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount} disabled={deleting}>
            <Text style={[styles.settingTitle, { color: C.DANGER }]}>
              {deleting ? 'Deleting…' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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

  sectionLabel: { fontFamily: FONTS.family, fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 8, marginTop: 16 },
  card: {
    backgroundColor: COLORS.CARD, borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingTitle: { fontFamily: FONTS.family, fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  settingDesc: { fontFamily: FONTS.family, fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  settingValue: { fontFamily: FONTS.family, fontSize: 14, color: COLORS.TEXT_SECONDARY },
  divider: { height: 1, backgroundColor: COLORS.BORDER, marginLeft: 16 },

  // Theme selector
  themeRow: {
    flexDirection: 'row', gap: 12, padding: 16,
  },
  themeOption: {
    flex: 1, borderRadius: 14, borderWidth: 2, overflow: 'hidden',
    alignItems: 'center', paddingBottom: 12, position: 'relative',
  },
  themeOptionActive: {
    borderWidth: 2,
  },
  themePreview: {
    width: '100%', height: 80, borderRadius: 0, overflow: 'hidden',
  },
  themePreviewBar: {
    height: 14, width: '100%',
  },
  themePreviewCard: {
    flex: 1, height: 30, borderRadius: 4, borderWidth: 1,
  },
  themePreviewNav: {
    height: 10, width: '100%', position: 'absolute', bottom: 0,
  },
  themeLabel: {
    fontFamily: FONTS.family,    fontSize: 13, fontWeight: '700', marginTop: 8,
  },
  themeCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SettingsScreen;
