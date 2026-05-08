import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { playersAPI, teamsAPI, usersAPI } from '../../services/api';
import { COLORS, FONTS } from '../../theme';
import Avatar from '../../components/Avatar';

const RADIUS = 12;

const AddPlayerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { teamId } = route.params;

  // Mode: 'mobile' (default) or 'guest'
  //   mobile — admin types a mobile. If a registered user exists with that
  //            mobile, their identity is used; otherwise a stub player is
  //            created that auto-links when they later register.
  //   guest  — walk-ins / kids / players with no phone. Permanent unlinkable
  //            stub (is_guest=true). Name only.
  const [mode, setMode] = useState('mobile');

  // Common fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jersey, setJersey] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [isViceCaptain, setIsViceCaptain] = useState(false);
  const [isWk, setIsWk] = useState(false);
  const [role, setRole] = useState('batsman');
  const [battingStyle, setBattingStyle] = useState('right');
  const [bowlingStyle, setBowlingStyle] = useState('fast');

  // Mobile-mode state
  const [mobile, setMobile] = useState('');
  const [lookup, setLookup] = useState({ state: 'idle', user: null });
  //   state: 'idle' | 'checking' | 'match' | 'no_match' | 'invalid'
  const lookupDebounce = useRef(null);

  const [loading, setLoading] = useState(false);

  const roles = [
    { key: 'batsman', label: 'Batsman', icon: 'cricket' },
    { key: 'bowler', label: 'Bowler', icon: 'baseball' },
    { key: 'all_rounder', label: 'All-Rounder', icon: 'account-star' },
    { key: 'wicket_keeper', label: 'Wicket Keeper', icon: 'shield-account' },
  ];

  // Live lookup when mobile changes in mobile-mode
  useEffect(() => {
    if (mode !== 'mobile') return;
    if (lookupDebounce.current) clearTimeout(lookupDebounce.current);

    const m = mobile.trim();
    if (m.length === 0) {
      setLookup({ state: 'idle', user: null });
      return;
    }
    if (!/^\d{10}$/.test(m)) {
      setLookup({ state: 'invalid', user: null });
      return;
    }
    setLookup({ state: 'checking', user: null });
    lookupDebounce.current = setTimeout(async () => {
      try {
        const res = await usersAPI.lookupByMobile(m);
        if (res.data?.exists) {
          setLookup({ state: 'match', user: res.data });
          // Auto-fill + lock the name fields to the user's registered identity.
          setFirstName(res.data.first_name || '');
          setLastName(res.data.last_name || '');
        } else {
          setLookup({ state: 'no_match', user: null });
        }
      } catch {
        // Lookup failure → don't block; treat as no_match so admin can still type
        setLookup({ state: 'no_match', user: null });
      }
    }, 400);
    return () => lookupDebounce.current && clearTimeout(lookupDebounce.current);
  }, [mobile, mode]);

  const handleAdd = async () => {
    // Validation
    if (mode === 'mobile') {
      if (!/^\d{10}$/.test(mobile.trim())) {
        return Alert.alert('Invalid', 'Enter a valid 10-digit mobile number.');
      }
      if (lookup.state !== 'match' && !firstName.trim()) {
        return Alert.alert('Required', 'Player name is required.');
      }
    } else {
      if (!firstName.trim()) {
        return Alert.alert('Required', 'Guest player name is required.');
      }
    }

    setLoading(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        role,
        batting_style: battingStyle,
        bowling_style: bowlingStyle,
      };
      if (mode === 'mobile') {
        payload.mobile = mobile.trim();
      } else {
        payload.is_guest = true;
      }
      const res = await playersAPI.create(payload);
      await teamsAPI.addPlayer(teamId, {
        player_id: res.data.id,
        jersey_number: jersey ? parseInt(jersey) : null,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
        is_wicket_keeper: isWk,
      });
      Alert.alert(
        'Success',
        mode === 'guest'
          ? 'Guest player added — no account linked.'
          : lookup.state === 'match'
            ? `Linked to ${lookup.user.full_name}`
            : 'Player added — will link when they register.',
      );
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setJersey('');
    setIsCaptain(false);
    setIsViceCaptain(false);
    setIsWk(false);
    setRole('batsman');
    setBattingStyle('right');
    setBowlingStyle('fast');
    setFirstName('');
    setLastName('');
    setMobile('');
    setLookup({ state: 'idle', user: null });
  };

  // When lookup finds a match, lock the name fields (editing would defeat the
  // purpose of the link). When there's no match, name fields are editable.
  const nameLocked = mode === 'mobile' && lookup.state === 'match';

  const renderToggleButton = (label, isSelected, onPress, style) => (
    <TouchableOpacity
      style={[
        styles.toggleBtn,
        isSelected && styles.toggleBtnActive,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.toggleBtnText, isSelected && styles.toggleBtnTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Player</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={40}
      >
          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'mobile' && styles.modeBtnActive]}
              onPress={() => { setMode('mobile'); resetForm(); }}
            >
              <Icon name="cellphone" size={18} color={mode === 'mobile' ? '#fff' : COLORS.TEXT_MUTED} />
              <Text style={[styles.modeBtnText, mode === 'mobile' && styles.modeBtnTextActive]}>
                By Mobile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'guest' && styles.modeBtnActive]}
              onPress={() => { setMode('guest'); resetForm(); }}
            >
              <Icon name="account-question-outline" size={18} color={mode === 'guest' ? '#fff' : COLORS.TEXT_MUTED} />
              <Text style={[styles.modeBtnText, mode === 'guest' && styles.modeBtnTextActive]}>
                Guest
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {mode === 'mobile' ? (
              <>
                {/* Mobile input with live lookup */}
                <View style={styles.inputWrapper}>
                  <Icon name="cellphone" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={mobile}
                    onChangeText={(v) => setMobile(v.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                  {lookup.state === 'checking' && (
                    <ActivityIndicator size="small" color={COLORS.ACCENT} style={{ marginLeft: 8 }} />
                  )}
                </View>

                {/* Lookup state feedback */}
                {lookup.state === 'invalid' && (
                  <Text style={styles.lookupHint}>Enter a valid 10-digit mobile number</Text>
                )}
                {lookup.state === 'match' && lookup.user && (
                  <View style={styles.matchCard}>
                    <Avatar
                      uri={lookup.user.profile}
                      name={lookup.user.full_name}
                      size={40}
                      color={COLORS.ACCENT}
                      type="player"
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Icon name="check-decagram" size={14} color={COLORS.SUCCESS_LIGHT} />
                        <Text style={styles.matchBadge}>Registered user</Text>
                      </View>
                      <Text style={styles.matchName}>{lookup.user.full_name}</Text>
                    </View>
                  </View>
                )}
                {lookup.state === 'no_match' && (
                  <View style={styles.noMatchCard}>
                    <Icon name="information-outline" size={14} color={COLORS.ACCENT_LIGHT} />
                    <Text style={styles.noMatchText}>
                      No account yet — enter their name. Will link automatically when they register.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.noMatchCard}>
                <Icon name="information-outline" size={14} color={COLORS.ACCENT_LIGHT} />
                <Text style={styles.noMatchText}>
                  Guest player — no mobile, no future app link. Use for walk-ins / kids without phones.
                </Text>
              </View>
            )}

            {/* Name fields — lock when lookup matched; editable otherwise */}
            <View style={[styles.inputWrapper, { marginTop: 12, opacity: nameLocked ? 0.6 : 1 }]}>
              <Icon name="account-outline" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={COLORS.TEXT_MUTED}
                editable={!nameLocked}
              />
            </View>
            <View style={[styles.inputWrapper, { marginTop: 10, opacity: nameLocked ? 0.6 : 1 }]}>
              <Icon name="account-outline" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name (optional)"
                placeholderTextColor={COLORS.TEXT_MUTED}
                editable={!nameLocked}
              />
            </View>

            {/* Jersey Number */}
            <View style={[styles.inputWrapper, { marginTop: 12 }]}>
              <Icon name="pound" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                value={jersey}
                onChangeText={setJersey}
                placeholder="Jersey number"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="numeric"
              />
            </View>

            {/* Playing Role */}
            <Text style={styles.sectionLabel}>Playing Role</Text>
            <View style={styles.roleGrid}>
              {roles.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleBtn, role === r.key && styles.roleBtnActive]}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={r.icon}
                    size={20}
                    color={role === r.key ? COLORS.ACCENT : COLORS.TEXT_MUTED}
                  />
                  <Text style={[styles.roleBtnText, role === r.key && styles.roleBtnTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Batting Style */}
            <Text style={styles.sectionLabel}>Batting Style</Text>
            <View style={styles.toggleRow}>
              {renderToggleButton('Right Hand', battingStyle === 'right', () => setBattingStyle('right'), { flex: 1 })}
              {renderToggleButton('Left Hand', battingStyle === 'left', () => setBattingStyle('left'), { flex: 1 })}
            </View>

            {/* Bowling Style */}
            <Text style={styles.sectionLabel}>Bowling Style</Text>
            <View style={styles.toggleRow}>
              {renderToggleButton('Fast', bowlingStyle === 'fast', () => setBowlingStyle('fast'), { flex: 1 })}
              {renderToggleButton('Medium', bowlingStyle === 'medium', () => setBowlingStyle('medium'), { flex: 1 })}
              {renderToggleButton('Spin', bowlingStyle === 'spin', () => setBowlingStyle('spin'), { flex: 1 })}
            </View>

            {/* Captain toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabelRow}>
                <Icon name="shield-star-outline" size={20} color={COLORS.TEXT} />
                <Text style={styles.switchLabel}>Captain</Text>
              </View>
              <Switch
                value={isCaptain}
                onValueChange={(v) => { setIsCaptain(v); if (v) setIsViceCaptain(false); }}
                trackColor={{ false: COLORS.SURFACE, true: COLORS.ACCENT }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.SURFACE}
              />
            </View>

            {/* Vice Captain toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabelRow}>
                <Icon name="shield-outline" size={20} color={COLORS.TEXT} />
                <Text style={styles.switchLabel}>Vice Captain</Text>
              </View>
              <Switch
                value={isViceCaptain}
                onValueChange={(v) => { setIsViceCaptain(v); if (v) setIsCaptain(false); }}
                trackColor={{ false: COLORS.SURFACE, true: COLORS.WARNING }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.SURFACE}
              />
            </View>

            {/* Wicket Keeper toggle */}
            <View style={styles.switchRow}>
              <View style={styles.switchLabelRow}>
                <Icon name="account-hard-hat" size={20} color={COLORS.TEXT} />
                <Text style={styles.switchLabel}>Is Wicket Keeper</Text>
              </View>
              <Switch
                value={isWk}
                onValueChange={setIsWk}
                trackColor={{ false: COLORS.SURFACE, true: COLORS.ACCENT }}
                thumbColor="#fff"
                ios_backgroundColor={COLORS.SURFACE}
              />
            </View>
          </View>

          {/* Add Player Button */}
          <TouchableOpacity
            style={[styles.addBtn, loading && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="account-plus" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.addBtnText}>Add Player</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.CARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  headerTitle: {
    fontFamily: FONTS.family,    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  headerSpacer: {
    width: 40,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Mode toggle
  modeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: 6,
  },
  modeBtnActive: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  modeBtnText: {
    fontFamily: FONTS.family,    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
  },
  modeBtnTextActive: {
    color: '#fff',
  },

  // Card
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  // Inputs
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    fontFamily: FONTS.family,    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT,
    height: 48,
  },

  // Section labels
  sectionLabel: {
    fontFamily: FONTS.family,    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Role grid (2x2)
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  roleBtn: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    gap: 8,
  },
  roleBtnActive: {
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  roleBtnText: {
    fontFamily: FONTS.family,    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_MUTED,
  },
  roleBtnTextActive: {
    color: COLORS.ACCENT_LIGHT,
    fontWeight: '600',
  },

  // Toggle buttons (batting/bowling style)
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  toggleBtnText: {
    fontFamily: FONTS.family,    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_MUTED,
  },
  toggleBtnTextActive: {
    color: COLORS.ACCENT_LIGHT,
    fontWeight: '600',
  },

  // Switch rows
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  switchLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabel: {
    fontFamily: FONTS.family,    fontSize: 15,
    fontWeight: '500',
    color: COLORS.TEXT,
  },

  /* Lookup feedback card — green when a registered user was matched */
  matchCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.SUCCESS_BG,
    borderRadius: RADIUS,
    padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: COLORS.SUCCESS + '40',
  },
  matchBadge: {
    fontFamily: FONTS.family,
    fontSize: 11, fontWeight: '800', color: COLORS.SUCCESS_LIGHT,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },
  matchName: { fontFamily: FONTS.family, fontSize: 14, fontWeight: '700', color: COLORS.TEXT, marginTop: 2 },

  /* No-match info card — gentle blue tint, explains the stub-linking behaviour */
  noMatchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.ACCENT_SOFT,
    borderRadius: RADIUS,
    paddingVertical: 9, paddingHorizontal: 12,
    marginTop: 10,
  },
  noMatchText: {
    fontFamily: FONTS.family,
    flex: 1, fontSize: 11, fontWeight: '600', color: COLORS.ACCENT_LIGHT,
  },
  lookupHint: {
    fontFamily: FONTS.family,
    fontSize: 11, color: COLORS.DANGER, marginTop: 6, marginLeft: 4,
  },

  // Search (legacy — preserved for any other callers)
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  searchingText: {
    fontFamily: FONTS.family,    marginLeft: 8,
    color: COLORS.TEXT_MUTED,
    fontSize: 13,
  },
  resultsList: {
    marginTop: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  resultAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInitial: {
    fontFamily: FONTS.family,    color: COLORS.ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  resultName: {
    fontFamily: FONTS.family,    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  resultMobile: {
    fontFamily: FONTS.family,    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
  },
  noResults: {
    fontFamily: FONTS.family,    color: COLORS.TEXT_MUTED,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
  },

  // Selected user
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ACCENT_SOFT,
    borderRadius: RADIUS,
    padding: 14,
    marginTop: 12,
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT,
  },
  selectedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedInitial: {
    fontFamily: FONTS.family,    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  selectedName: {
    fontFamily: FONTS.family,    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  selectedMobile: {
    fontFamily: FONTS.family,    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  changeLink: {
    fontFamily: FONTS.family,    color: COLORS.ACCENT_LIGHT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Add button
  addBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.ACCENT,
    borderRadius: RADIUS,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  addBtnDisabled: {
    opacity: 0.7,
  },
  addBtnText: {
    fontFamily: FONTS.family,    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddPlayerScreen;
