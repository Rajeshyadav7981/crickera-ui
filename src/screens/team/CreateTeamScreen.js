import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { teamsAPI, tournamentsAPI } from '../../services/api';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { COLORS, FONTS } from '../../theme';
import BackButton from '../../components/BackButton';
import CurrentLocationButton from '../../components/CurrentLocationButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';

const TEAM_COLORS = [COLORS.SUCCESS, COLORS.ACCENT_DARK, COLORS.DANGER, '#F9A825', '#7B1FA2', '#FF6D00', '#00695C', '#0097A7', '#E91E63'];

const CreateTeamScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  useAuthGate('create a team');
  const tournamentId = route.params?.tournamentId;
  const editingTeamId = route.params?.teamId || null;
  const isEditMode = !!editingTeamId;
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState(COLORS.SUCCESS);
  const [homeGround, setHomeGround] = useState('');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prefilling, setPrefilling] = useState(isEditMode);

  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await teamsAPI.get(editingTeamId);
        if (cancelled) return;
        const t = res.data?.team || {};
        setName(t.name || '');
        setShortName(t.short_name || '');
        if (t.color) setColor(t.color);
        setHomeGround(t.home_ground || '');
        setCity(t.city || '');
        if (t.latitude != null && t.longitude != null) {
          setCoords({ latitude: t.latitude, longitude: t.longitude });
        }
      } catch (e) {
        toast.error(e.response?.data?.detail || 'Failed to load team');
        navigation.goBack();
      } finally {
        if (!cancelled) setPrefilling(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editingTeamId, isEditMode]);

  const handleSubmit = async () => {
    if (!name.trim()) return toast.error('Team name is required');
    if (shortName.trim() && (shortName.trim().length < 3 || shortName.trim().length > 4)) {
      return toast.error('Short name must be 3-4 characters');
    }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        short_name: shortName.trim() || null,
        color,
        home_ground: homeGround.trim() || null,
        city: city.trim() || null,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      };
      if (isEditMode) {
        await teamsAPI.update(editingTeamId, payload);
        toast.success('Team updated');
        navigation.goBack();
      } else {
        const res = await teamsAPI.create(payload);
        if (tournamentId) {
          await tournamentsAPI.addTeam(tournamentId, res.data.id);
        }
        toast.success('Team created', `Code: ${res.data.team_code}`, 4500);
        navigation.replace('TeamDetail', { teamId: res.data.id });
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || (isEditMode ? 'Failed to update team' : 'Failed to create team'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Team' : 'Create Team'}</Text>
        <View style={{ width: 36 }} />
      </View>

      {prefilling ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.ACCENT} />
        </View>
      ) : (
      <KeyboardAwareScrollView
        style={styles.scrollArea}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={40}
      >
        {/* Form Card */}
        <View style={styles.formCard}>
          {/* Team Name */}
          <Text style={styles.label}>Team Name</Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="shield-outline" size={18} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Mumbai Indians"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
          </View>

          {/* Short Name */}
          <Text style={styles.label}>Short Name (3-4 chars)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.inputField, { paddingLeft: 16 }]}
              value={shortName}
              onChangeText={(text) => setShortName(text.toUpperCase())}
              placeholder="e.g. MI"
              placeholderTextColor={COLORS.TEXT_MUTED}
              maxLength={4}
              autoCapitalize="characters"
            />
          </View>

          {/* Team Color */}
          <Text style={styles.label}>Team Color</Text>
          <View style={styles.colorRow}>
            {TEAM_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }]}
                onPress={() => setColor(c)}
                activeOpacity={0.7}
              >
                {color === c && (
                  <View style={styles.checkOverlay}>
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Home Ground */}
          <Text style={styles.label}>Home Ground</Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={homeGround}
              onChangeText={setHomeGround}
              placeholder="e.g. Wankhede Stadium"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
          </View>

          {/* Location */}
          <Text style={styles.label}>Team Location</Text>
          <View style={styles.inputWrapper}>
            <MaterialCommunityIcons name="earth" size={18} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.inputField}
              value={city}
              onChangeText={(t) => { setCity(t); setCoords(null); }}
              placeholder="e.g. Mumbai, India"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
          </View>
          <CurrentLocationButton
            onLocation={(loc) => {
              setCity(loc.displayName);
              setCoords({ latitude: loc.latitude, longitude: loc.longitude });
            }}
            onError={(msg) => toast.error(msg)}
          />
          {coords && (
            <Text style={{ fontSize: 11, color: COLORS.SUCCESS, marginTop: 4 }}>
              <MaterialCommunityIcons name="check" size={11} /> Location set
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.createBtn, loading && styles.createBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>
            {loading
              ? (isEditMode ? 'Saving...' : 'Creating...')
              : (isEditMode ? 'Save Changes' : 'Create Team')}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: FONTS.family,    fontSize: 18,
    color: COLORS.TEXT,
    marginTop: -1,
  },
  headerTitle: {
    fontFamily: FONTS.family,    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  headerSpacer: {
    width: 40,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 24,
    marginTop: 8,
  },
  label: {
    fontFamily: FONTS.family,    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
    marginTop: 18,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    height: 48,
  },
  inputIcon: {
    fontFamily: FONTS.family,    fontSize: 16,
    marginLeft: 14,
    marginRight: 2,
  },
  inputField: {
    fontFamily: FONTS.family,    flex: 1,
    height: 48,
    fontSize: 15,
    color: COLORS.TEXT,
    paddingHorizontal: 10,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOverlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    fontFamily: FONTS.family,    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: '700',
  },
  createBtn: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 16,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    fontFamily: FONTS.family,    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateTeamScreen;
