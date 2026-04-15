import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, TextInput, Platform, Modal, FlatList, InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesAPI, teamsAPI, venuesAPI } from '../../services/api';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { COLORS } from '../../theme';
import StepIndicator from '../../components/StepIndicator';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = COLORS.ACCENT;
const BG = COLORS.BG;
const DARK = COLORS.TEXT;
const BORDER = COLORS.BORDER;
const MUTED = COLORS.TEXT_MUTED;
const MID = COLORS.TEXT_SECONDARY;

const MATCH_CATEGORIES = [
  { key: 'friendly', label: 'Friendly Match', icon: '🤝', desc: 'Casual match between two teams' },
  { key: 'practice', label: 'Practice Match', icon: '🏋', desc: 'Practice or warm-up game' },
  { key: 'tournament', label: 'Tournament Match', icon: '🏆', desc: 'Part of a tournament' },
];

const OVERS_PRESETS = [
  { label: 'T5', overs: 5 },
  { label: 'T10', overs: 10 },
  { label: 'T20', overs: 20 },
];
const CAL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const BALL_TYPES = ['Tennis', 'Leather', 'Rubber'];
const PITCH_TYPES = ['Turf', 'Cement', 'Matting', 'Artificial'];

const QuickMatchScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('create a match');

  // Step state
  const [step, setStep] = useState(0); // 0=type, 1=teams, 2=details, 3=review

  // Step 0: Match type
  const [matchCategory, setMatchCategory] = useState('friendly');

  // Step 1: Teams
  const [allTeams, setAllTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [selectingFor, setSelectingFor] = useState(null); // 'A' or 'B'

  // Step 2: Match details
  const [overs, setOvers] = useState(20);
  const [ballType, setBallType] = useState('Tennis');
  const [pitchType, setPitchType] = useState(null);
  const [venues, setVenues] = useState([]);
  const [venue, setVenue] = useState(null);
  const [matchDate, setMatchDate] = useState('');
  const [venueModal, setVenueModal] = useState(false);
  const [venueSearchText, setVenueSearchText] = useState('');
  const [venueSearchResults, setVenueSearchResults] = useState([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null); // location picked, awaiting optional name
  const [venueNameInput, setVenueNameInput] = useState('');

  // Step 3: Creating
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      loadTeams();
      loadVenues();
    });
    return () => task.cancel();
  }, []);

  const loadTeams = async () => {
    setTeamsLoading(true);
    try {
      const res = await teamsAPI.list();
      setAllTeams(res.data || []);
    } catch (_) {}
    setTeamsLoading(false);
  };

  const loadVenues = async () => {
    try {
      const res = await venuesAPI.list();
      setVenues(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
  };

  // Venue location search with debounce
  const venueTimerRef = React.useRef(null);
  const handleVenueSearch = (text) => {
    setVenueSearchText(text);
    if (venueTimerRef.current) clearTimeout(venueTimerRef.current);
    if (text.length < 3) { setVenueSearchResults([]); return; }
    venueTimerRef.current = setTimeout(async () => {
      setVenueSearching(true);
      try {
        const res = await venuesAPI.searchLocation(text);
        setVenueSearchResults(res.data || []);
      } catch { setVenueSearchResults([]); }
      setVenueSearching(false);
    }, 500);
  };

  const pickVenueFromSearch = (loc) => {
    // Show name input step before creating
    const defaultName = loc.display_name.split(',')[0] || loc.display_name;
    setPendingLocation(loc);
    setVenueNameInput(defaultName);
    setVenueSearchResults([]);
    setVenueSearchText('');
  };

  const confirmVenueFromSearch = async () => {
    if (!pendingLocation) return;
    try {
      const res = await venuesAPI.create({
        name: venueNameInput.trim() || pendingLocation.display_name.split(',')[0],
        city: pendingLocation.city || '',
        address: pendingLocation.display_name,
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
      });
      setVenue(res.data);
      setVenues(prev => [res.data, ...prev]);
      setPendingLocation(null);
      setVenueNameInput('');
      setVenueModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create venue');
    }
  };

  const handleCreateMatch = async () => {
    if (!teamA || !teamB) return Alert.alert('Error', 'Select both teams');
    if (teamA.id === teamB.id) return Alert.alert('Error', 'Teams must be different');

    setCreating(true);
    try {
      const res = await matchesAPI.create({
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        overs,
        match_type: matchCategory,
        ...(venue && { venue_id: venue.id }),
        ...(matchDate && { match_date: matchDate }),
      });
      const match = res.data;
      // Navigate to toss screen
      navigation.replace('Toss', {
        matchId: match.id,
        match: { ...match, team_a_id: teamA.id, team_b_id: teamB.id },
        teams: [teamA, teamB],
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to create match');
    } finally {
      setCreating(false);
    }
  };

  const goNext = () => {
    if (step === 0) {
      if (matchCategory === 'tournament') {
        return navigation.replace('MainTabs', { screen: 'Tournaments' });
      }
      setStep(1);
    } else if (step === 1) {
      if (!teamA || !teamB) return Alert.alert('Select Teams', 'Choose both Team A and Team B');
      if (teamA.id === teamB.id) return Alert.alert('Error', 'Teams must be different');
      setStep(2);
    } else if (step === 2) {
      // Mandatory fields for step 2 → step 3:
      //   • Overs (always has a default)
      //   • Venue / location  ← required
      //   • Match date        ← required
      // Check in order so the user gets a single, specific error each time.
      if (!venue) {
        return Alert.alert('Venue required', 'Please select a venue or location for the match.');
      }
      if (!matchDate) {
        return Alert.alert('Date required', 'Please select the match date.');
      }
      setStep(3);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  const filteredTeams = allTeams.filter(t => {
    if (!teamSearch.trim()) return true;
    const q = teamSearch.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.short_name || '').toLowerCase().includes(q);
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showCustomOvers, setShowCustomOvers] = useState(false);
  const [customOversVal, setCustomOversVal] = useState('');

  const formatDateStr = (ds) => {
    if (!ds) return '';
    const [y, m, d] = ds.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${CAL_DAYS[dt.getDay()]}, ${d} ${CAL_MONTHS[m - 1].slice(0, 3)} ${y}`;
  };

  const STEP_LABELS = ['Match Type', 'Teams', 'Details', 'Review'];

  /* ═══════════════════════════════════ */
  /* STEP 0: MATCH TYPE                 */
  /* ═══════════════════════════════════ */
  const renderTypeStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What kind of match?</Text>
      <Text style={styles.stepSubtitle}>Select the match type to get started</Text>

      {MATCH_CATEGORIES.map(cat => {
        const active = matchCategory === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[styles.typeCard, active && styles.typeCardActive]}
            onPress={() => setMatchCategory(cat.key)}
            activeOpacity={0.7}
          >
            <Text style={styles.typeIcon}>{cat.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.typeLabel, active && { color: COLORS.ACCENT_LIGHT }]}>{cat.label}</Text>
              <Text style={styles.typeDesc}>{cat.desc}</Text>
            </View>
            <View style={[styles.radio, active && styles.radioActive]}>
              {active && <View style={styles.radioFill} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  /* ═══════════════════════════════════ */
  /* STEP 1: CHOOSE TEAMS               */
  /* ═══════════════════════════════════ */
  const renderTeamSlot = (label, team, side) => (
    <TouchableOpacity
      style={[styles.teamSlot, team && styles.teamSlotFilled]}
      onPress={() => setSelectingFor(side)}
      activeOpacity={0.7}
    >
      {team ? (
        <>
          <View style={[styles.teamSlotCircle, { backgroundColor: team.color || COLORS.BORDER }]}>
            <Text style={styles.teamSlotInitial}>{(team.short_name || team.name || '?')[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamSlotName}>{team.name}</Text>
            <Text style={styles.teamSlotShort}>{team.short_name || ''}</Text>
          </View>
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); side === 'A' ? setTeamA(null) : setTeamB(null); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 16, color: MUTED }}>x</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.teamSlotEmpty}>
            <Text style={{ fontSize: 20, color: MUTED }}>+</Text>
          </View>
          <Text style={styles.teamSlotPlaceholder}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const renderTeamsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose Teams</Text>
      <Text style={styles.stepSubtitle}>Select two teams or create new ones</Text>

      {/* Team A & B slots */}
      <View style={styles.teamSlotsContainer}>
        {renderTeamSlot('Select Team A', teamA, 'A')}
        <View style={styles.vsCircle}><Text style={styles.vsText}>VS</Text></View>
        {renderTeamSlot('Select Team B', teamB, 'B')}
      </View>

      {/* Team picker */}
      {selectingFor && (
        <View style={styles.teamPicker}>
          <View style={styles.teamPickerHeader}>
            <Text style={styles.teamPickerTitle}>Select Team {selectingFor}</Text>
            <TouchableOpacity onPress={() => setSelectingFor(null)}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.LIVE }}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBar}>
            <Text style={{ fontSize: 14, marginRight: 8 }}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={teamSearch}
              onChangeText={setTeamSearch}
              placeholder="Search teams..."
              placeholderTextColor={MUTED}
            />
          </View>

          {/* Create new team */}
          <TouchableOpacity
            style={styles.createTeamRow}
            onPress={() => { setSelectingFor(null); navigation.navigate('CreateTeam', {}); }}
          >
            <View style={styles.createTeamIcon}><Text style={{ color: COLORS.TEXT, fontWeight: '700', fontSize: 14 }}>+</Text></View>
            <Text style={styles.createTeamText}>Create New Team</Text>
          </TouchableOpacity>

          {teamsLoading ? (
            <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 16 }} />
          ) : (
            <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
              {filteredTeams.map(t => {
                const alreadySelected = (selectingFor === 'A' && teamB?.id === t.id) ||
                                        (selectingFor === 'B' && teamA?.id === t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.teamPickRow, alreadySelected && { opacity: 0.4 }]}
                    onPress={() => {
                      if (alreadySelected) return;
                      if (selectingFor === 'A') setTeamA(t);
                      else setTeamB(t);
                      setSelectingFor(null);
                      setTeamSearch('');
                    }}
                    disabled={alreadySelected}
                  >
                    <View style={[styles.teamPickDot, { backgroundColor: t.color || COLORS.BORDER }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamPickName}>{t.name}</Text>
                      {t.short_name ? <Text style={styles.teamPickShort}>{t.short_name}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Same team warning */}
      {teamA && teamB && teamA.id === teamB.id && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>Both teams are the same. Select different teams.</Text>
        </View>
      )}
    </View>
  );

  /* ═══════════════════════════════════ */
  /* STEP 2: MATCH DETAILS              */
  /* ═══════════════════════════════════ */
  const renderDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Match Settings</Text>
      <Text style={styles.stepSubtitle}>
        Overs, ball type, and pitch are configurable. Venue and date are required.
      </Text>

      {/* Overs */}
      <Text style={styles.fieldLabel}>Overs Per Side</Text>
      <View style={styles.toggleRow}>
        {OVERS_PRESETS.map(p => {
          const active = overs === p.overs && !showCustomOvers;
          return (
            <TouchableOpacity
              key={p.label}
              style={[styles.toggleBtn, active && styles.toggleBtnActive]}
              onPress={() => { setOvers(p.overs); setShowCustomOvers(false); }}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.toggleBtn, (showCustomOvers || !OVERS_PRESETS.find(p => p.overs === overs)) && styles.toggleBtnActive]}
          onPress={() => setShowCustomOvers(true)}
        >
          <Text style={[styles.toggleText, (showCustomOvers || !OVERS_PRESETS.find(p => p.overs === overs)) && styles.toggleTextActive]}>
            {!OVERS_PRESETS.find(p => p.overs === overs) && !showCustomOvers ? `T${overs}` : 'Custom'}
          </Text>
        </TouchableOpacity>
      </View>
      {showCustomOvers && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TextInput
            style={[styles.selectBox, { flex: 1 }]}
            value={customOversVal}
            onChangeText={setCustomOversVal}
            placeholder="Enter overs (1-100)"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TouchableOpacity
            style={{ backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 20, height: 48, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              const n = parseInt(customOversVal);
              if (n && n > 0 && n <= 100) { setOvers(n); setShowCustomOvers(false); }
              else Alert.alert('Invalid', 'Enter a number between 1-100');
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT }}>OK</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Ball Type */}
      <Text style={styles.fieldLabel}>Ball Type</Text>
      <View style={styles.toggleRow}>
        {BALL_TYPES.map(b => (
          <TouchableOpacity
            key={b}
            style={[styles.toggleBtn, ballType === b && styles.toggleBtnActive]}
            onPress={() => setBallType(b)}
          >
            <Text style={[styles.toggleText, ballType === b && styles.toggleTextActive]}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pitch Type */}
      <Text style={styles.fieldLabel}>Pitch Type</Text>
      <View style={styles.toggleRow}>
        {PITCH_TYPES.map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, pitchType === p && styles.toggleBtnActive]}
            onPress={() => setPitchType(pitchType === p ? null : p)}
          >
            <Text style={[styles.toggleText, pitchType === p && styles.toggleTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Venue — REQUIRED */}
      <Text style={styles.fieldLabel}>
        Venue / Location <Text style={{ color: COLORS.LIVE }}>*</Text>
      </Text>
      {venue ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: DARK }}>{venue.name}</Text>
            {venue.city ? <Text style={{ fontSize: 11, color: MID, marginTop: 2 }}>{venue.city}</Text> : null}
          </View>
          <TouchableOpacity onPress={() => setVenue(null)}>
            <MaterialCommunityIcons name="close" size={18} color={COLORS.LIVE} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.selectBox} onPress={() => setVenueModal(true)}>
          <Text style={[styles.selectText, { color: MUTED }]}>Search or select venue...</Text>
          <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.TEXT_MUTED} />
        </TouchableOpacity>
      )}

      {/* Date — REQUIRED */}
      <Text style={styles.fieldLabel}>
        Match Date <Text style={{ color: COLORS.LIVE }}>*</Text>
      </Text>
      <TouchableOpacity style={styles.selectBox} onPress={() => {
        const init = matchDate ? new Date(matchDate + 'T00:00:00') : new Date();
        setCalYear(init.getFullYear()); setCalMonth(init.getMonth());
        setShowCalendar(true);
      }}>
        <Text style={[styles.selectText, !matchDate && { color: MUTED }]}>
          {matchDate ? formatDateStr(matchDate) : 'Select date...'}
        </Text>
        <MaterialCommunityIcons name="calendar" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>

      {/* Venue modal with search */}
      <Modal visible={venueModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          {/* Background dismiss area */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setVenueModal(false); setVenueSearchText(''); setVenueSearchResults([]); setPendingLocation(null); }}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Venue</Text>

            {pendingLocation ? (
              /* Step 2: Enter venue name for the selected location */
              <View>
                <View style={{ backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER }}>
                  <Text style={{ fontSize: 12, color: COLORS.ACCENT, marginBottom: 2 }}><MaterialCommunityIcons name="check" size={12} color={COLORS.ACCENT} /> Location selected</Text>
                  <Text style={{ fontSize: 13, color: DARK, lineHeight: 18 }} numberOfLines={2}>{pendingLocation.display_name}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: DARK, marginBottom: 6 }}>Venue Name</Text>
                <TextInput
                  style={{ height: 44, backgroundColor: COLORS.SURFACE, borderRadius: 8, borderWidth: 1.5, borderColor: PRIMARY, paddingHorizontal: 14, fontSize: 15, color: DARK }}
                  value={venueNameInput}
                  onChangeText={setVenueNameInput}
                  placeholder="e.g. Wankhede Stadium"
                  placeholderTextColor={MUTED}
                  autoFocus
                />
                <Text style={{ fontSize: 11, color: MUTED, marginTop: 4, marginBottom: 12 }}>Give this venue a short name (or keep the default)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => { setPendingLocation(null); setVenueNameInput(''); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: DARK }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                    onPress={confirmVenueFromSearch}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.TEXT }}>Add Venue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Step 1: Search or pick existing */
              <View>
                {/* Location search input */}
                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={{ height: 44, backgroundColor: COLORS.SURFACE, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, fontSize: 14, color: DARK }}
                    value={venueSearchText}
                    onChangeText={handleVenueSearch}
                    placeholder="Search location (e.g. Mumbai, Wankhede)..."
                    placeholderTextColor={MUTED}
                    autoFocus
                  />
                  {venueSearching && <Text style={{ position: 'absolute', right: 12, top: 14, fontSize: 12, color: MUTED }}>...</Text>}
                </View>

                {/* Search results */}
                {venueSearchResults.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 4 }}>SEARCH RESULTS</Text>
                    <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {venueSearchResults.map((item, i) => (
                        <TouchableOpacity
                          key={i}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER }}
                          onPress={() => pickVenueFromSearch(item)}
                        >
                          <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
                          <Text style={{ flex: 1, fontSize: 13, color: DARK, lineHeight: 18 }} numberOfLines={2}>{item.display_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Existing venues */}
                {venues.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: MUTED, marginBottom: 4 }}>YOUR VENUES</Text>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {venues.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.modalOption, venue?.id === item.id && styles.modalOptionActive]}
                          onPress={() => { setVenue(item); setVenueModal(false); setVenueSearchText(''); setVenueSearchResults([]); }}
                        >
                          <Text style={[styles.modalOptionText, venue?.id === item.id && { color: PRIMARY, fontWeight: '700' }]}>
                            {item.name}
                          </Text>
                          {item.city ? <Text style={{ fontSize: 11, color: MUTED }}>{item.city}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={styles.modalCancel} onPress={() => { setVenueModal(false); setVenueSearchText(''); setVenueSearchResults([]); }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.LIVE }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Calendar modal */}
      <Modal visible={showCalendar} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <View style={styles.calendarWrap} onStartShouldSetResponder={() => true}>
            {(() => {
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
              const canGoPrev = calMonth === 0
                ? new Date(calYear - 1, 11, 1) >= new Date(now.getFullYear(), now.getMonth(), 1)
                : new Date(calYear, calMonth - 1, 1) >= new Date(now.getFullYear(), now.getMonth(), 1);
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const firstDay = new Date(calYear, calMonth, 1).getDay();
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(<View key={`e${i}`} style={styles.calCell} />);
              for (let d = 1; d <= daysInMonth; d++) {
                const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isSel = ds === matchDate;
                const isToday = ds === todayStr;
                const dayDate = new Date(calYear, calMonth, d);
                dayDate.setHours(0, 0, 0, 0);
                const isPast = dayDate < now;
                cells.push(
                  <TouchableOpacity
                    key={d}
                    style={[styles.calCell, isSel && styles.calCellSelected, isToday && !isSel && styles.calCellToday]}
                    onPress={() => { if (!isPast) { setMatchDate(ds); setShowCalendar(false); } }}
                    disabled={isPast}
                  >
                    <Text style={[
                      styles.calDayText,
                      isSel && styles.calDayTextSelected,
                      isToday && !isSel && styles.calDayTextToday,
                      isPast && { opacity: 0.25 },
                    ]}>{d}</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <>
                  <View style={styles.calHeader}>
                    <TouchableOpacity
                      onPress={() => { if (canGoPrev) { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); } }}
                      style={[styles.calNavBtn, !canGoPrev && { opacity: 0.3 }]}
                      disabled={!canGoPrev}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.TEXT} />
                    </TouchableOpacity>
                    <Text style={styles.calMonthYear}>{CAL_MONTHS[calMonth]} {calYear}</Text>
                    <TouchableOpacity onPress={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }} style={styles.calNavBtn}>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.TEXT} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.calRow}>
                    {CAL_DAYS.map(dd => (
                      <View key={dd} style={styles.calCell}>
                        <Text style={styles.calDayHeader}>{dd}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.calGrid}>{cells}</View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                    <TouchableOpacity onPress={() => { setMatchDate(todayStr); setShowCalendar(false); }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: PRIMARY, paddingVertical: 8, paddingHorizontal: 16 }}>Today</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowCalendar(false)}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.LIVE, paddingVertical: 8, paddingHorizontal: 16 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );

  /* ═══════════════════════════════════ */
  /* STEP 3: REVIEW & CREATE            */
  /* ═══════════════════════════════════ */
  const renderReviewStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Start</Text>
      <Text style={styles.stepSubtitle}>Confirm match details before starting</Text>

      {/* Match preview card */}
      <View style={styles.reviewCard}>
        {/* Teams */}
        <View style={styles.reviewTeamsRow}>
          <View style={styles.reviewTeamCol}>
            <View style={[styles.reviewTeamCircle, { backgroundColor: teamA?.color || '#3B82F6' }]}>
              <Text style={styles.reviewTeamInitial}>{(teamA?.short_name || teamA?.name || '?')[0]}</Text>
            </View>
            <Text style={styles.reviewTeamName} numberOfLines={2}>{teamA?.name}</Text>
          </View>

          <View style={styles.reviewVsBox}>
            <Text style={styles.reviewVsText}>VS</Text>
          </View>

          <View style={styles.reviewTeamCol}>
            <View style={[styles.reviewTeamCircle, { backgroundColor: teamB?.color || COLORS.RED }]}>
              <Text style={styles.reviewTeamInitial}>{(teamB?.short_name || teamB?.name || '?')[0]}</Text>
            </View>
            <Text style={styles.reviewTeamName} numberOfLines={2}>{teamB?.name}</Text>
          </View>
        </View>

        <View style={styles.reviewDivider} />

        {/* Details grid */}
        <View style={styles.reviewDetailsGrid}>
          <View style={styles.reviewDetailItem}>
            <Text style={styles.reviewDetailLabel}>Format</Text>
            <Text style={styles.reviewDetailValue}>T{overs}</Text>
          </View>
          <View style={styles.reviewDetailItem}>
            <Text style={styles.reviewDetailLabel}>Ball</Text>
            <Text style={styles.reviewDetailValue}>{ballType}</Text>
          </View>
          <View style={styles.reviewDetailItem}>
            <Text style={styles.reviewDetailLabel}>Type</Text>
            <Text style={styles.reviewDetailValue}>
              {matchCategory.charAt(0).toUpperCase() + matchCategory.slice(1)}
            </Text>
          </View>
          {pitchType && (
            <View style={styles.reviewDetailItem}>
              <Text style={styles.reviewDetailLabel}>Pitch</Text>
              <Text style={styles.reviewDetailValue}>{pitchType}</Text>
            </View>
          )}
        </View>

        {venue && (
          <View style={styles.reviewInfoRow}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>📍</Text>
            <Text style={styles.reviewInfoText}>{venue.name}</Text>
          </View>
        )}
        {matchDate && (
          <View style={styles.reviewInfoRow}>
            <Text style={{ fontSize: 14, marginRight: 6 }}>📅</Text>
            <Text style={styles.reviewInfoText}>{matchDate}</Text>
          </View>
        )}
      </View>

      {/* Flow info */}
      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>What's Next?</Text>
        {[
          { step: '1', label: 'Record Toss', desc: 'Who won and chose to bat/bowl' },
          { step: '2', label: 'Select Playing XI', desc: 'Pick 11 players for each team' },
          { step: '3', label: 'Choose Openers', desc: 'Opening batsmen & bowler' },
          { step: '4', label: 'Start Scoring', desc: 'Ball-by-ball live scoring' },
        ].map((item, i) => (
          <View key={i} style={styles.flowRow}>
            <View style={styles.flowStepCircle}>
              <Text style={styles.flowStepNum}>{item.step}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.flowLabel}>{item.label}</Text>
              <Text style={styles.flowDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Create & Start button */}
      <TouchableOpacity
        style={[styles.createBtn, creating && { opacity: 0.6 }]}
        onPress={handleCreateMatch}
        disabled={creating}
        activeOpacity={0.8}
      >
        {creating ? (
          <ActivityIndicator color={COLORS.TEXT} />
        ) : (
          <Text style={styles.createBtnText}>Create Match & Start Toss</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (step) {
      case 0: return renderTypeStep();
      case 1: return renderTeamsStep();
      case 2: return renderDetailsStep();
      case 3: return renderReviewStep();
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Match</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <StepIndicator
        steps={STEP_LABELS}
        currentStep={step}
        onStepPress={(i) => { if (i <= step) setStep(i); }}
      />

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: step < 3 ? 100 : 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderContent()}
      </ScrollView>

      {/* Bottom bar (not on review step) */}
      {step < 3 && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          {step > 0 && (
            <TouchableOpacity style={styles.backNavBtn} onPress={goBack}>
              <Text style={styles.backNavBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.nextBtn, step === 0 && { flex: 1 }]} onPress={goNext}>
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ═══════════════════════ STYLES ═══════════════════════ */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 18, color: DARK },
  headerTitle: { fontSize: 17, fontWeight: '700', color: DARK },

  /* Steps */
  stepContent: { paddingTop: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: DARK },
  stepSubtitle: { fontSize: 14, color: MUTED, marginTop: 4, marginBottom: 20, lineHeight: 20 },

  /* Type cards */
  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD,
    borderRadius: 14, borderWidth: 1.5, borderColor: BORDER,
    padding: 16, marginBottom: 10, gap: 14,
  },
  typeCardActive: { borderColor: PRIMARY, backgroundColor: COLORS.ACCENT_SOFT },
  typeIcon: { fontSize: 28 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: DARK },
  typeDesc: { fontSize: 12, color: MUTED, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: PRIMARY },
  radioFill: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

  /* Team slots */
  teamSlotsContainer: { alignItems: 'center', marginBottom: 20 },
  teamSlot: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.CARD,
    borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, borderStyle: 'dashed',
    padding: 16, width: '100%', gap: 12, minHeight: 72,
  },
  teamSlotFilled: { borderStyle: 'solid', borderColor: PRIMARY },
  teamSlotCircle: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  teamSlotInitial: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },
  teamSlotEmpty: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center',
  },
  teamSlotName: { fontSize: 15, fontWeight: '700', color: DARK },
  teamSlotShort: { fontSize: 12, color: MUTED },
  teamSlotPlaceholder: { fontSize: 14, color: MUTED },
  vsCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginVertical: 8,
  },
  vsText: { fontSize: 12, fontWeight: '800', color: COLORS.TEXT },

  /* Team picker */
  teamPicker: {
    backgroundColor: COLORS.CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 12,
  },
  teamPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  teamPickerTitle: { fontSize: 15, fontWeight: '700', color: DARK },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SURFACE,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER, height: 40,
    paddingHorizontal: 10, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: DARK },
  createTeamRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, gap: 10,
  },
  createTeamIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  createTeamText: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  teamPickRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, gap: 10,
  },
  teamPickDot: { width: 32, height: 32, borderRadius: 16 },
  teamPickName: { fontSize: 14, fontWeight: '600', color: DARK },
  teamPickShort: { fontSize: 11, color: MUTED },

  /* Warning */
  warningBanner: {
    backgroundColor: COLORS.LIVE_BG, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
    padding: 12, marginTop: 8,
  },
  warningText: { fontSize: 13, color: COLORS.LIVE, fontWeight: '500' },

  /* Details */
  fieldLabel: { fontSize: 14, fontWeight: '600', color: DARK, marginBottom: 10, marginTop: 18 },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  toggleBtn: {
    flex: 1, minWidth: 70, height: 42, borderRadius: 10,
    backgroundColor: COLORS.SURFACE, borderWidth: 1.5, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleBtnActive: { backgroundColor: COLORS.ACCENT_SOFT, borderColor: PRIMARY },
  toggleText: { fontSize: 13, fontWeight: '600', color: MID },
  toggleTextActive: { color: COLORS.ACCENT_LIGHT },
  selectBox: {
    height: 48, backgroundColor: COLORS.SURFACE, borderRadius: 10, borderWidth: 1,
    borderColor: BORDER, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  selectText: { fontSize: 14, color: DARK, flex: 1 },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'center', paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: COLORS.CARD, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: DARK, marginBottom: 12 },
  modalOption: {
    paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  modalOptionActive: { backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 8 },
  modalOptionText: { fontSize: 15, color: DARK },
  modalCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },

  /* Review card */
  reviewCard: {
    backgroundColor: COLORS.CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    padding: 20, marginBottom: 16,
  },
  reviewTeamsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  reviewTeamCol: { flex: 1, alignItems: 'center' },
  reviewTeamCircle: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  reviewTeamInitial: { fontSize: 22, fontWeight: '700', color: COLORS.TEXT },
  reviewTeamName: { fontSize: 14, fontWeight: '600', color: DARK, textAlign: 'center' },
  reviewVsBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.SURFACE_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },
  reviewVsText: { fontSize: 13, fontWeight: '800', color: COLORS.TEXT },
  reviewDivider: { height: 1, backgroundColor: COLORS.BORDER, marginVertical: 16 },
  reviewDetailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  reviewDetailItem: {
    backgroundColor: BG, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    flex: 1, minWidth: 80,
  },
  reviewDetailLabel: { fontSize: 11, color: MUTED, fontWeight: '500' },
  reviewDetailValue: { fontSize: 15, fontWeight: '700', color: DARK, marginTop: 2 },
  reviewInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  reviewInfoText: { fontSize: 13, color: MID },

  /* Flow card */
  flowCard: {
    backgroundColor: COLORS.CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 16, marginBottom: 20,
  },
  flowTitle: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 12 },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  flowStepCircle: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.ACCENT_SOFT,
    alignItems: 'center', justifyContent: 'center',
  },
  flowStepNum: { fontSize: 12, fontWeight: '700', color: COLORS.ACCENT_LIGHT },
  flowLabel: { fontSize: 13, fontWeight: '600', color: DARK },
  flowDesc: { fontSize: 11, color: MUTED },

  /* Create button */
  createBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginBottom: 20,
  },
  createBtnText: { color: COLORS.TEXT, fontSize: 16, fontWeight: '700' },

  /* Bottom nav */
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12,
    backgroundColor: COLORS.CARD, borderTopWidth: 1, borderTopColor: BORDER, gap: 10,
  },
  backNavBtn: {
    backgroundColor: COLORS.SURFACE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20,
  },
  backNavBtnText: { fontSize: 14, fontWeight: '600', color: DARK },
  nextBtn: {
    flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  nextBtnText: { color: COLORS.TEXT, fontSize: 15, fontWeight: '700' },

  /* Calendar */
  calendarWrap: { backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE, alignItems: 'center', justifyContent: 'center' },
  calNavText: { fontSize: 12, color: MID },
  calMonthYear: { fontSize: 16, fontWeight: '700', color: DARK },
  calRow: { flexDirection: 'row' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' },
  calCellSelected: { backgroundColor: PRIMARY, borderRadius: 20 },
  calCellToday: { borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 20 },
  calDayHeader: { fontSize: 11, fontWeight: '700', color: MUTED, textTransform: 'uppercase' },
  calDayText: { fontSize: 14, fontWeight: '500', color: DARK },
  calDayTextSelected: { color: COLORS.TEXT, fontWeight: '700' },
  calDayTextToday: { color: PRIMARY, fontWeight: '700' },
});

export default QuickMatchScreen;
