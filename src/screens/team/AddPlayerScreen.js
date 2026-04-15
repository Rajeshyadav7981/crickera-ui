import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { playersAPI, teamsAPI, usersAPI } from '../../services/api';
import { COLORS } from '../../theme';

const RADIUS = 12;

const AddPlayerScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { teamId } = route.params;

  // Mode: 'search' (default) or 'guest'
  const [mode, setMode] = useState('search');

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const debounceRef = useRef(null);

  // Team-player options (shared between search-add and guest)
  const [playerName, setPlayerName] = useState('');
  const [jersey, setJersey] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [isViceCaptain, setIsViceCaptain] = useState(false);
  const [isWk, setIsWk] = useState(false);
  const [role, setRole] = useState('batsman');
  const [battingStyle, setBattingStyle] = useState('right');
  const [bowlingStyle, setBowlingStyle] = useState('fast');

  // Guest form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');

  const [loading, setLoading] = useState(false);

  const roles = [
    { key: 'batsman', label: 'Batsman', icon: 'cricket' },
    { key: 'bowler', label: 'Bowler', icon: 'baseball' },
    { key: 'all_rounder', label: 'All-Rounder', icon: 'account-star' },
    { key: 'wicket_keeper', label: 'Wicket Keeper', icon: 'shield-account' },
  ];

  const handleSearch = useCallback((text) => {
    setQuery(text);
    setSelectedUser(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await usersAPI.search(text.trim());
        setResults(res.data || []);
      } catch (e) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setResults([]);
    setQuery(u.full_name || `${u.first_name} ${u.last_name}`);
    setPlayerName(u.full_name || `${u.first_name} ${u.last_name}`);
  };

  const handleAddFromSearch = async () => {
    if (!selectedUser) return Alert.alert('Error', 'Select a user first');
    setLoading(true);
    try {
      const res = await playersAPI.create({
        first_name: selectedUser.first_name,
        last_name: selectedUser.last_name,
        mobile: selectedUser.mobile,
        role,
        batting_style: battingStyle,
        bowling_style: bowlingStyle,
        user_id: selectedUser.id,
      });
      await teamsAPI.addPlayer(teamId, {
        player_id: res.data.id,
        jersey_number: jersey ? parseInt(jersey) : null,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
        is_wicket_keeper: isWk,
      });
      Alert.alert('Success', 'Player added!');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuest = async () => {
    if (!playerName.trim() && !firstName.trim()) return Alert.alert('Error', 'Player name is required');
    setLoading(true);
    try {
      const nameParts = playerName.trim().split(' ');
      const fName = firstName.trim() || nameParts[0] || '';
      const lName = lastName.trim() || nameParts.slice(1).join(' ') || '';
      const res = await playersAPI.create({
        first_name: fName,
        last_name: lName || null,
        mobile: mobile.trim() || null,
        role,
        batting_style: battingStyle,
        bowling_style: bowlingStyle,
      });
      await teamsAPI.addPlayer(teamId, {
        player_id: res.data.id,
        jersey_number: jersey ? parseInt(jersey) : null,
        is_captain: isCaptain,
        is_vice_captain: isViceCaptain,
        is_wicket_keeper: isWk,
      });
      Alert.alert('Success', 'Guest player added!');
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
    setSelectedUser(null);
    setQuery('');
    setResults([]);
    setPlayerName('');
    setFirstName('');
    setLastName('');
    setMobile('');
  };

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mode toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'search' && styles.modeBtnActive]}
              onPress={() => { setMode('search'); resetForm(); }}
            >
              <Icon name="magnify" size={18} color={mode === 'search' ? '#fff' : COLORS.TEXT_MUTED} />
              <Text style={[styles.modeBtnText, mode === 'search' && styles.modeBtnTextActive]}>
                Search Users
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'guest' && styles.modeBtnActive]}
              onPress={() => { setMode('guest'); resetForm(); }}
            >
              <Icon name="account-plus" size={18} color={mode === 'guest' ? '#fff' : COLORS.TEXT_MUTED} />
              <Text style={[styles.modeBtnText, mode === 'guest' && styles.modeBtnTextActive]}>
                Add Guest
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {mode === 'search' ? (
              <>
                {/* Search bar */}
                <View style={styles.inputWrapper}>
                  <Icon name="magnify" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={query}
                    onChangeText={handleSearch}
                    placeholder="Search by name or mobile..."
                    placeholderTextColor={COLORS.TEXT_MUTED}
                    autoCapitalize="none"
                  />
                </View>

                {/* Search results */}
                {searching && (
                  <View style={styles.searchingRow}>
                    <ActivityIndicator size="small" color={COLORS.ACCENT} />
                    <Text style={styles.searchingText}>Searching...</Text>
                  </View>
                )}

                {results.length > 0 && !selectedUser && (
                  <View style={styles.resultsList}>
                    {results.map((u) => (
                      <TouchableOpacity key={u.id} style={styles.resultItem} onPress={() => handleSelectUser(u)}>
                        <View style={styles.resultAvatar}>
                          <Text style={styles.resultInitial}>{u.first_name?.charAt(0)?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.resultName}>{u.full_name || `${u.first_name} ${u.last_name}`}</Text>
                          <Text style={styles.resultMobile}>{u.mobile}</Text>
                        </View>
                        <Icon name="chevron-right" size={20} color={COLORS.TEXT_MUTED} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {query.length >= 2 && !searching && results.length === 0 && !selectedUser && (
                  <Text style={styles.noResults}>No users found. Try "Add Guest" to add manually.</Text>
                )}

                {/* Selected user card */}
                {selectedUser && (
                  <View style={styles.selectedCard}>
                    <View style={styles.selectedAvatar}>
                      <Text style={styles.selectedInitial}>{selectedUser.first_name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.selectedName}>{selectedUser.full_name || `${selectedUser.first_name} ${selectedUser.last_name}`}</Text>
                      <Text style={styles.selectedMobile}>{selectedUser.mobile}</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedUser(null); setQuery(''); }}>
                      <Text style={styles.changeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Player Name */}
                <View style={styles.inputWrapper}>
                  <Icon name="account-outline" size={20} color={COLORS.TEXT_MUTED} style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    value={playerName}
                    onChangeText={setPlayerName}
                    placeholder="Full name"
                    placeholderTextColor={COLORS.TEXT_MUTED}
                  />
                </View>
              </>
            )}

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
            onPress={mode === 'search' ? handleAddFromSearch : handleAddGuest}
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
        </ScrollView>
      </KeyboardAvoidingView>
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
    fontSize: 18,
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
    fontSize: 14,
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
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT,
    height: 48,
  },

  // Section labels
  sectionLabel: {
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 13,
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
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.TEXT,
  },

  // Search
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  searchingText: {
    marginLeft: 8,
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
    color: COLORS.ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  resultMobile: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
    marginTop: 2,
  },
  noResults: {
    color: COLORS.TEXT_MUTED,
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
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  selectedMobile: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  changeLink: {
    color: COLORS.ACCENT_LIGHT,
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddPlayerScreen;
