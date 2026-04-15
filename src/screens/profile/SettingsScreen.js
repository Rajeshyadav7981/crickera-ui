import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useThemeContext } from '../../context/ThemeContext';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';

const SettingsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const { isDark, toggleTheme, colors: C } = useThemeContext();
  const [notifications, setNotifications] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState(true);
  const [soundEffects, setSoundEffects] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Info', 'Please contact support to delete your account.');
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
        {/* Appearance Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <View style={styles.themeRow}>
            {/* Light option */}
            <TouchableOpacity
              style={[
                styles.themeOption,
                { backgroundColor: '#FFFFFF', borderColor: !isDark ? C.ACCENT : '#E0E2EA' },
                !isDark && styles.themeOptionActive,
              ]}
              onPress={() => { if (isDark) toggleTheme(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.themePreview, { backgroundColor: '#F5F6FA' }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: '#FFFFFF' }]} />
                <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
                  <View style={[styles.themePreviewCard, { backgroundColor: '#FFFFFF', borderColor: '#E0E2EA' }]} />
                  <View style={[styles.themePreviewCard, { backgroundColor: '#FFFFFF', borderColor: '#E0E2EA' }]} />
                </View>
                <View style={[styles.themePreviewNav, { backgroundColor: '#FFFFFF' }]} />
              </View>
              <Text style={[styles.themeLabel, { color: '#1A1A2E' }]}>Light</Text>
              {!isDark && <View style={[styles.themeCheck, { backgroundColor: C.ACCENT }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>}
            </TouchableOpacity>

            {/* Dark option */}
            <TouchableOpacity
              style={[
                styles.themeOption,
                { backgroundColor: '#16161F', borderColor: isDark ? C.ACCENT : '#2A2A3C' },
                isDark && styles.themeOptionActive,
              ]}
              onPress={() => { if (!isDark) toggleTheme(); }}
              activeOpacity={0.7}
            >
              <View style={[styles.themePreview, { backgroundColor: '#0B0B12' }]}>
                <View style={[styles.themePreviewBar, { backgroundColor: '#16161F' }]} />
                <View style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
                  <View style={[styles.themePreviewCard, { backgroundColor: '#1C1C28', borderColor: '#2A2A3C' }]} />
                  <View style={[styles.themePreviewCard, { backgroundColor: '#1C1C28', borderColor: '#2A2A3C' }]} />
                </View>
                <View style={[styles.themePreviewNav, { backgroundColor: '#16161F' }]} />
              </View>
              <Text style={[styles.themeLabel, { color: '#FFFFFF' }]}>Dark</Text>
              {isDark && <View style={[styles.themeCheck, { backgroundColor: C.ACCENT }]}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.TEXT }]}>Push Notifications</Text>
              <Text style={[styles.settingDesc, { color: C.TEXT_SECONDARY }]}>Get notified about match updates</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: C.SURFACE, true: C.ACCENT + '66' }}
              thumbColor={notifications ? C.ACCENT : C.TEXT_MUTED}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: C.BORDER }]} />
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.TEXT }]}>Live Score Updates</Text>
              <Text style={[styles.settingDesc, { color: C.TEXT_SECONDARY }]}>Real-time scoring notifications</Text>
            </View>
            <Switch
              value={liveUpdates}
              onValueChange={setLiveUpdates}
              trackColor={{ false: C.SURFACE, true: C.ACCENT + '66' }}
              thumbColor={liveUpdates ? C.ACCENT : C.TEXT_MUTED}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: C.BORDER }]} />
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: C.TEXT }]}>Sound Effects</Text>
              <Text style={[styles.settingDesc, { color: C.TEXT_SECONDARY }]}>Play sounds for wickets, boundaries</Text>
            </View>
            <Switch
              value={soundEffects}
              onValueChange={setSoundEffects}
              trackColor={{ false: C.SURFACE, true: C.ACCENT + '66' }}
              thumbColor={soundEffects ? C.ACCENT : C.TEXT_MUTED}
            />
          </View>
        </View>

        {/* App Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>App</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <View style={styles.settingRow}>
            <Text style={[styles.settingTitle, { color: C.TEXT }]}>App Version</Text>
            <Text style={[styles.settingValue, { color: C.TEXT_SECONDARY }]}>1.0.0</Text>
          </View>
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionLabel, { color: C.TEXT_SECONDARY }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: C.CARD, borderColor: C.BORDER }]}>
          <TouchableOpacity style={styles.settingRow} onPress={logout}>
            <Text style={[styles.settingTitle, { color: C.ACCENT }]}>Sign Out</Text>
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: C.BORDER }]} />
          <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
            <Text style={[styles.settingTitle, { color: C.DANGER }]}>Delete Account</Text>
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
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 22, color: COLORS.TEXT, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  content: { padding: 20, paddingBottom: 40 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_SECONDARY, marginBottom: 8, marginTop: 16 },
  card: {
    backgroundColor: COLORS.CARD, borderRadius: 14, borderWidth: 1, borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  settingTitle: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  settingDesc: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  settingValue: { fontSize: 14, color: COLORS.TEXT_SECONDARY },
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
    fontSize: 13, fontWeight: '700', marginTop: 8,
  },
  themeCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SettingsScreen;
