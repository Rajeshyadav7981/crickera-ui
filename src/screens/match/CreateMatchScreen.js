import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert,
  Modal, FlatList, ActivityIndicator, TextInput, InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { matchesAPI, venuesAPI, tournamentsAPI } from '../../services/api';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { COLORS } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CurrentLocationButton from '../../components/CurrentLocationButton';

const PRIMARY = COLORS.ACCENT;
const PRIMARY_20 = COLORS.ACCENT_SOFT;
const BG = COLORS.BG;
const BORDER = COLORS.BORDER;
const TEXT_DARK = COLORS.TEXT;
const TEXT_MID = COLORS.TEXT_SECONDARY;
const TEXT_LIGHT = COLORS.TEXT_MUTED;

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
  '05:00 PM - 07:00 PM',
];

const MATCH_TYPES = ['Group', 'Quarter', 'Semi', 'Final'];

const stagePrettyName = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/* reusable dropdown with optional search */
const DropdownSelect = ({ label, value, displayText, options, keyExtractor, labelExtractor, onSelect, searchable = false }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchMode, setSearchMode] = useState('name'); // 'name' or 'code'

  const filtered = searchable && search.trim()
    ? options.filter((item) => {
        const q = search.trim().toLowerCase();
        if (searchMode === 'code') {
          return (item.team_code || '').toLowerCase() === q;
        }
        return labelExtractor(item).toLowerCase().includes(q);
      })
    : options;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selectBox} activeOpacity={0.7} onPress={() => { setOpen(true); setSearch(''); setSearchMode('name'); }}>
        <Text style={[styles.selectText, !value && { color: TEXT_LIGHT }]}>
          {displayText || 'Select...'}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{label}</Text>
            {searchable && (
              <>
                <View style={styles.searchModeRow}>
                  {[{ key: 'name', icon: 'magnify', label: 'Name' }, { key: 'code', icon: 'pound', label: 'Code' }].map((m) => (
                    <TouchableOpacity
                      key={m.key}
                      style={[styles.searchModeBtn, searchMode === m.key && styles.searchModeBtnActive]}
                      onPress={() => { setSearchMode(m.key); setSearch(''); }}
                    >
                      <MaterialCommunityIcons name={m.icon} size={13} color={searchMode === m.key ? '#fff' : TEXT_LIGHT} />
                      <Text style={[styles.searchModeText, searchMode === m.key && styles.searchModeTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.searchInputWrap}>
                  <MaterialCommunityIcons name={searchMode === 'code' ? 'pound' : 'magnify'} size={18} color={TEXT_LIGHT} />
                  <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder={searchMode === 'code' ? 'Enter team code (e.g. T4KX9R)' : 'Search by team name...'}
                    placeholderTextColor={TEXT_LIGHT}
                    autoCapitalize={searchMode === 'code' ? 'characters' : 'none'}
                    autoFocus
                  />
                </View>
              </>
            )}
            <FlatList
              data={filtered}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = value && keyExtractor(item) === keyExtractor(value);
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, selected && styles.modalOptionActive]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalOptionText, selected && { color: PRIMARY, fontWeight: '700' }]}>
                        {labelExtractor(item)}
                      </Text>
                      {item.team_code && (
                        <Text style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 1 }}>{item.team_code}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={{ color: TEXT_LIGHT, textAlign: 'center', padding: 20, fontSize: 13 }}>No results found</Text>}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const StringDropdown = ({ label, value, placeholder, options, onSelect }) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selectBox} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && { color: TEXT_LIGHT }]}>
          {value || placeholder || 'Select...'}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = value === item;
                return (
                  <TouchableOpacity
                    style={[styles.modalOption, selected && styles.modalOptionActive]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                  >
                    <Text style={[styles.modalOptionText, selected && { color: PRIMARY, fontWeight: '700' }]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 320 }}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const CalendarPicker = ({ visible, onClose, value, onSelect }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initial = value ? new Date(value + 'T00:00:00') : today;
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value + 'T00:00:00') : new Date();
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }, [visible, value]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Min date = today
  const canGoPrev = month === 0
    ? new Date(year - 1, 11, 1) >= new Date(today.getFullYear(), today.getMonth(), 1)
    : new Date(year, month - 1, 1) >= new Date(today.getFullYear(), today.getMonth(), 1);

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day) => {
    const dayDate = new Date(year, month, day);
    dayDate.setHours(0, 0, 0, 0);
    if (dayDate < today) return;
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onSelect(`${year}-${mm}-${dd}`);
    onClose();
  };

  const selectedStr = value;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.calendarWrap} onStartShouldSetResponder={() => true}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={prevMonth} style={[styles.calNavBtn, !canGoPrev && { opacity: 0.3 }]} disabled={!canGoPrev}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.TEXT} />
            </TouchableOpacity>
            <Text style={styles.calMonthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
              <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.TEXT} />
            </TouchableOpacity>
          </View>

          <View style={styles.calRow}>
            {DAYS.map(d => (
              <View key={d} style={styles.calCell}>
                <Text style={styles.calDayHeader}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calGrid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={styles.calCell} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = dateStr === selectedStr;
              const isToday = dateStr === todayStr;
              const dayDate = new Date(year, month, day);
              dayDate.setHours(0, 0, 0, 0);
              const isPast = dayDate < today;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.calCell, isSelected && styles.calCellSelected, isToday && !isSelected && styles.calCellToday]}
                  onPress={() => selectDay(day)}
                  disabled={isPast}
                >
                  <Text style={[
                    styles.calDayText,
                    isSelected && styles.calDayTextSelected,
                    isToday && !isSelected && styles.calDayTextToday,
                    isPast && { opacity: 0.25 },
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.calFooter}>
            <TouchableOpacity onPress={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); selectDay(today.getDate()); }} style={styles.calTodayBtn}>
              <Text style={styles.calTodayText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.calCancelBtn}>
              <Text style={styles.calCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const DateInput = ({ label, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const display = value ? formatDateDisplay(value) : 'Select date';
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selectBox} activeOpacity={0.7} onPress={() => setOpen(true)}>
        <Text style={[styles.selectText, !value && { color: TEXT_LIGHT }]}>{display}</Text>
        <MaterialCommunityIcons name="calendar" size={16} color={COLORS.TEXT_MUTED} />
      </TouchableOpacity>
      <CalendarPicker visible={open} onClose={() => setOpen(false)} value={value} onSelect={onChange} />
    </View>
  );
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
};

const OVERS_OPTIONS = [5, 10, 15, 20, 25, 30, 50];

const OversInput = ({ label, value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const isCustom = value && !OVERS_OPTIONS.includes(value);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.oversRow}>
        {OVERS_OPTIONS.map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.oversBtn, value === n && styles.oversBtnActive]}
            onPress={() => { onChange(n); setShowCustom(false); }}
          >
            <Text style={[styles.oversBtnText, value === n && styles.oversBtnTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.oversBtn, (isCustom || showCustom) && styles.oversBtnActive]}
          onPress={() => setShowCustom(true)}
        >
          <Text style={[styles.oversBtnText, (isCustom || showCustom) && styles.oversBtnTextActive]}>
            {isCustom ? value : '...'}
          </Text>
        </TouchableOpacity>
      </View>
      {showCustom && (
        <View style={styles.customOversRow}>
          <TextInput
            style={styles.customOversInput}
            value={customVal}
            onChangeText={setCustomVal}
            placeholder="Enter overs"
            placeholderTextColor={TEXT_LIGHT}
            keyboardType="number-pad"
            maxLength={3}
          />
          <TouchableOpacity
            style={styles.customOversOk}
            onPress={() => {
              const n = parseInt(customVal);
              if (n && n > 0 && n <= 100) { onChange(n); setShowCustom(false); }
              else Alert.alert('Invalid', 'Enter a number between 1-100');
            }}
          >
            <Text style={styles.customOversOkText}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ========== MAIN SCREEN ========== */
const CreateMatchScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { ready } = useAuthGate('create a match');
  const { tournamentId, teams } = route.params || {};

  const [activeView, setActiveView] = useState('fixtures'); // 'fixtures' or 'create'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fixtures data
  const [fixtures, setFixtures] = useState([]);
  const [stages, setStages] = useState([]);
  const [venues, setVenues] = useState([]);
  const [fixtureSchedule, setFixtureSchedule] = useState({}); // { matchId: { match_date, time_slot, venue } }

  // Create new match form
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [teamA, setTeamA] = useState(null);
  const [teamB, setTeamB] = useState(null);
  const [matchDate, setMatchDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [venue, setVenue] = useState(null);
  const [venueSearch, setVenueSearch] = useState('');
  const [venueSearchResults, setVenueSearchResults] = useState([]);
  const [venueSearching, setVenueSearching] = useState(false);
  const [venueModalVisible, setVenueModalVisible] = useState(false);
  const [pendingVenueLoc, setPendingVenueLoc] = useState(null);
  const [venueNameInput, setVenueNameInput] = useState('');
  const [matchType, setMatchType] = useState('Group');
  const [overs, setOvers] = useState(20);

  // Derive match type from stage name
  const stageToMatchType = (stageName) => {
    if (!stageName) return 'Group';
    const s = stageName.toLowerCase();
    if (s.includes('final') && !s.includes('semi') && !s.includes('quarter')) return 'Final';
    if (s.includes('semi')) return 'Semi';
    if (s.includes('quarter')) return 'Quarter';
    return 'Group';
  };

  // Is the selected stage a group stage (has groups)?
  const isGroupStage = selectedStage && (selectedStage.groups || []).length > 0;
  const isKnockoutStage = selectedStage && !isGroupStage;

  // Compute available teams based on stage/group selection
  const getAvailableTeams = () => {
    if (!selectedStage) return teams || [];

    if (isGroupStage && selectedGroup) {
      // Show only teams in the selected group, exclude eliminated
      return (selectedGroup.teams || [])
        .filter(t => t.qualification_status !== 'eliminated')
        .map(t => {
          const full = teamMap[t.team_id];
          return full || { id: t.team_id, name: t.team_name, short_name: t.short_name };
        });
    }

    if (isKnockoutStage) {
      // For knockout stages, show only qualified teams (from all groups in prior stages)
      const qualifiedTeamIds = new Set();
      stages.forEach(s => {
        if (s.stage_order < selectedStage.stage_order) {
          (s.groups || []).forEach(g => {
            (g.teams || []).forEach(t => {
              if (t.qualification_status === 'qualified') qualifiedTeamIds.add(t.team_id);
            });
          });
        }
      });
      // If no qualified teams found yet, show all tournament teams
      if (qualifiedTeamIds.size === 0) return teams || [];
      return (teams || []).filter(t => qualifiedTeamIds.has(t.id));
    }

    return teams || [];
  };

  const availableTeams = getAvailableTeams();

  // Build team lookup
  const teamMap = {};
  (teams || []).forEach(t => { teamMap[t.id] = t; });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tournRes, venueRes] = await Promise.all([
        tournamentsAPI.get(tournamentId),
        venuesAPI.list().catch(() => ({ data: [] })),
      ]);
      const tData = tournRes.data;
      setFixtures(tData.matches || []);
      setStages(tData.stages || []);
      setVenues(Array.isArray(venueRes.data) ? venueRes.data : venueRes.data?.results || []);

      // Populate any existing schedule data
      const schedMap = {};
      (tData.matches || []).forEach(m => {
        if (m.match_date || m.time_slot) {
          schedMap[m.id] = { match_date: m.match_date || '', time_slot: m.time_slot || '' };
        }
      });
      setFixtureSchedule(schedMap);
    } catch (_) {}
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => { loadData(); });
    return () => task.cancel();
  }, [loadData]);

  // Venue location search with debounce
  const venueTimerRef = React.useRef(null);
  const handleVenueSearchChange = (text) => {
    setVenueSearch(text);
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

  const selectVenueFromSearch = (loc) => {
    // Show name input step
    const defaultName = loc.display_name.split(',')[0] || loc.display_name;
    setPendingVenueLoc(loc);
    setVenueNameInput(defaultName);
    setVenueSearchResults([]);
    setVenueSearch('');
  };

  const confirmVenueCreate = async () => {
    if (!pendingVenueLoc) return;
    try {
      const res = await venuesAPI.create({
        name: venueNameInput.trim() || pendingVenueLoc.display_name.split(',')[0],
        city: pendingVenueLoc.city || '',
        address: pendingVenueLoc.display_name,
        latitude: pendingVenueLoc.latitude,
        longitude: pendingVenueLoc.longitude,
      });
      const newVenue = res.data;
      setVenue(newVenue);
      setVenues(prev => [newVenue, ...prev]);
      setPendingVenueLoc(null);
      setVenueNameInput('');
      setVenueModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create venue');
    }
  };

  const getTeamName = (id) => {
    const t = teamMap[id];
    return t?.short_name || t?.name || 'TBD';
  };

  const getTeamColor = (id) => teamMap[id]?.color || '#94A3B8';

  // Update schedule for a specific fixture
  const updateFixtureField = (matchId, field, value) => {
    setFixtureSchedule(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || {}), [field]: value },
    }));
  };

  // Save schedule for a stage's matches
  const saveScheduleForStage = async (stageId) => {
    const stageMatches = fixtures.filter(m => m.stage_id === stageId && m.status === 'upcoming');
    const schedule = stageMatches
      .filter(m => fixtureSchedule[m.id])
      .map(m => ({
        match_id: m.id,
        match_date: fixtureSchedule[m.id]?.match_date || null,
        time_slot: fixtureSchedule[m.id]?.time_slot || null,
      }))
      .filter(s => s.match_date || s.time_slot);

    if (schedule.length === 0) {
      return Alert.alert('No Changes', 'Set dates or time slots for at least one match.');
    }

    setSaving(true);
    try {
      await tournamentsAPI.scheduleMatches(tournamentId, stageId, schedule);
      Alert.alert('Saved', `${schedule.length} match(es) scheduled!`);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to save schedule');
    }
    setSaving(false);
  };

  // Create a new individual match
  const handleCreateMatch = async () => {
    if (!teamA || !teamB) return Alert.alert('Error', 'Select both teams');
    if (teamA.id === teamB.id) return Alert.alert('Error', 'Teams must be different');
    setSaving(true);
    try {
      const payload = {
        tournament_id: tournamentId,
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        overs,
        match_type: matchType.toLowerCase(),
        ...(matchDate && { match_date: matchDate }),
        ...(timeSlot && { time_slot: timeSlot }),
        ...(venue && { venue_id: venue.id, venue_name: venue.name }),
        ...(selectedStage && { stage_id: selectedStage.stage_id }),
        ...(selectedGroup && { group_id: selectedGroup.group_id }),
      };
      await matchesAPI.create(payload);
      Alert.alert('Success', 'Match created!');
      setSelectedStage(null); setSelectedGroup(null);
      setTeamA(null); setTeamB(null); setMatchDate(''); setTimeSlot(''); setVenue(null); setMatchType('Group'); setOvers(20);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to create match');
    }
    setSaving(false);
  };

  // Group fixtures by stage
  const groupedFixtures = {};
  fixtures.forEach(m => {
    const key = m.stage_id || 'individual';
    if (!groupedFixtures[key]) groupedFixtures[key] = [];
    groupedFixtures[key].push(m);
  });

  const getStageInfo = (stageId) => {
    for (const s of stages) {
      if (s.stage_id === stageId) return s;
    }
    return null;
  };

  const teamBOptions = availableTeams.filter((t) => t.id !== teamA?.id);

  // Calendar for fixture dates
  const [calendarMatchId, setCalendarMatchId] = useState(null);

  /* ─── Fixture scheduling inline controls ─── */
  const renderFixtureCard = (match) => {
    const sched = fixtureSchedule[match.id] || {};
    const isCompleted = match.status === 'completed';
    const isLive = match.status === 'live';
    const isScheduled = match.match_date || match.time_slot;
    const groupName = match.group_name;

    const statusBg = isCompleted ? COLORS.COMPLETED : isLive ? COLORS.LIVE : isScheduled ? COLORS.INFO : COLORS.TEXT_MUTED;
    const statusText = isCompleted ? 'DONE' : isLive ? 'LIVE' : isScheduled ? 'SCHEDULED' : 'UNSCHEDULED';

    return (
      <View key={match.id} style={[styles.fixtureCard, isCompleted && { opacity: 0.6 }]}>
        {/* Top row: match number, group, status */}
        <View style={styles.fixtureTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {match.match_number && (
              <View style={styles.matchNumBadge}>
                <Text style={styles.matchNumText}>#{match.match_number}</Text>
              </View>
            )}
            {groupName && (
              <View style={styles.groupBadge}>
                <Text style={styles.groupBadgeText}>{groupName}</Text>
              </View>
            )}
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusBg }]}>
            <Text style={styles.statusDotText}>{statusText}</Text>
          </View>
        </View>

        {/* Teams row */}
        <View style={styles.fixtureTeamsRow}>
          <View style={styles.fixtureTeam}>
            <View style={[styles.teamFlag, { backgroundColor: getTeamColor(match.team_a_id) }]}>
              <Text style={styles.teamFlagText}>{getTeamName(match.team_a_id).charAt(0)}</Text>
            </View>
            <Text style={styles.fixtureTeamName} numberOfLines={1}>{getTeamName(match.team_a_id)}</Text>
          </View>
          <Text style={styles.fixtureVs}>vs</Text>
          <View style={styles.fixtureTeam}>
            <View style={[styles.teamFlag, { backgroundColor: getTeamColor(match.team_b_id) }]}>
              <Text style={styles.teamFlagText}>{getTeamName(match.team_b_id).charAt(0)}</Text>
            </View>
            <Text style={styles.fixtureTeamName} numberOfLines={1}>{getTeamName(match.team_b_id)}</Text>
          </View>
        </View>

        {/* Result for completed matches */}
        {isCompleted && match.result_summary && (
          <Text style={styles.fixtureResult}>{match.result_summary}</Text>
        )}

        {/* Schedule controls for upcoming matches */}
        {!isCompleted && !isLive && (
          <View style={styles.scheduleControls}>
            {/* Date */}
            <TouchableOpacity
              style={styles.scheduleField}
              onPress={() => setCalendarMatchId(match.id)}
            >
              <MaterialCommunityIcons name="calendar" size={16} color={COLORS.TEXT_MUTED} />
              <Text style={[styles.scheduleFieldText, !(sched.match_date || match.match_date) && { color: TEXT_LIGHT }]}>
                {(sched.match_date || match.match_date) ? formatDateDisplay(sched.match_date || match.match_date) : 'Set Date'}
              </Text>
            </TouchableOpacity>

            {/* Time slot */}
            <TimeSlotPicker
              value={sched.time_slot || match.time_slot}
              onChange={(slot) => updateFixtureField(match.id, 'time_slot', slot)}
            />
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centerView, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Management</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* View toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.viewToggleBtn, activeView === 'fixtures' && styles.viewToggleBtnActive]}
          onPress={() => setActiveView('fixtures')}
        >
          <Text style={[styles.viewToggleText, activeView === 'fixtures' && styles.viewToggleTextActive]}>
            Fixtures ({fixtures.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewToggleBtn, activeView === 'create' && styles.viewToggleBtnActive]}
          onPress={() => setActiveView('create')}
        >
          <Text style={[styles.viewToggleText, activeView === 'create' && styles.viewToggleTextActive]}>
            + New Match
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* FIXTURES VIEW */}
        {activeView === 'fixtures' && (
          <>
            {fixtures.length === 0 ? (
              <View style={styles.emptyWrap}>
                <MaterialCommunityIcons name="cricket" size={40} color={COLORS.TEXT_MUTED} style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>No Fixtures Yet</Text>
                <Text style={styles.emptyText}>
                  Generate fixtures from the Tournament Setup, or create individual matches.
                </Text>
              </View>
            ) : (
              Object.entries(groupedFixtures).map(([stageKey, stageMatches]) => {
                const stageInfo = getStageInfo(Number(stageKey));
                const upcomingInStage = stageMatches.filter(m => m.status === 'upcoming');
                const sortedMatches = [...stageMatches].sort((a, b) => (a.match_number || 0) - (b.match_number || 0));

                return (
                  <View key={stageKey} style={styles.stageSection}>
                    {/* Stage header */}
                    <View style={styles.stageHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.stageName}>
                          {stageInfo ? stagePrettyName(stageInfo.stage_name) : 'Individual Matches'}
                        </Text>
                        <Text style={styles.stageCount}>
                          {stageMatches.length} matches
                          {upcomingInStage.length > 0 ? ` \u00B7 ${upcomingInStage.length} to schedule` : ''}
                        </Text>
                      </View>
                      {stageInfo && upcomingInStage.length > 0 && (
                        <TouchableOpacity
                          style={styles.saveScheduleBtn}
                          onPress={() => saveScheduleForStage(Number(stageKey))}
                          disabled={saving}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.saveScheduleBtnText}>Save Schedule</Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Fixture cards */}
                    {sortedMatches.map(renderFixtureCard)}
                  </View>
                );
              })
            )}
          </>
        )}

        {/* CREATE NEW MATCH VIEW */}
        {activeView === 'create' && (
          <>
            <Text style={styles.pageTitle}>Create New Match</Text>
            <Text style={styles.pageSubtitle}>
              Schedule an individual match outside of generated fixtures.
            </Text>

            <View style={styles.card}>
              {/* Stage selector */}
              {stages.length > 0 && (
                <DropdownSelect
                  label="Stage"
                  value={selectedStage}
                  displayText={selectedStage ? stagePrettyName(selectedStage.stage_name) : null}
                  options={stages}
                  keyExtractor={(s) => String(s.stage_id)}
                  labelExtractor={(s) => stagePrettyName(s.stage_name)}
                  onSelect={(s) => {
                    setSelectedStage(s);
                    setSelectedGroup(null);
                    setTeamA(null);
                    setTeamB(null);
                    setMatchType(stageToMatchType(s.stage_name));
                  }}
                />
              )}

              {/* Group selector — only for group stages */}
              {isGroupStage && (
                <DropdownSelect
                  label="Group"
                  value={selectedGroup}
                  displayText={selectedGroup ? selectedGroup.group_name : null}
                  options={selectedStage.groups}
                  keyExtractor={(g) => String(g.group_id)}
                  labelExtractor={(g) => `${g.group_name} (${(g.teams || []).filter(t => t.qualification_status !== 'eliminated').length} teams)`}
                  onSelect={(g) => {
                    setSelectedGroup(g);
                    setTeamA(null);
                    setTeamB(null);
                  }}
                />
              )}

              <DropdownSelect
                label="Select Team A"
                value={teamA}
                displayText={teamA?.name}
                options={availableTeams}
                keyExtractor={(t) => String(t.id)}
                labelExtractor={(t) => t.name}
                onSelect={setTeamA}
                searchable
                searchPlaceholder="Search by name or code..."
              />
              <DropdownSelect
                label="Select Team B"
                value={teamB}
                displayText={teamB?.name}
                options={teamBOptions}
                keyExtractor={(t) => String(t.id)}
                labelExtractor={(t) => t.name}
                onSelect={setTeamB}
                searchable
                searchPlaceholder="Search by name or code..."
              />
              <DateInput label="Match Date" value={matchDate} onChange={setMatchDate} />
              <OversInput label="Overs" value={overs} onChange={setOvers} />
              <StringDropdown
                label="Time Slot"
                value={timeSlot}
                placeholder="Select time slot"
                options={TIME_SLOTS}
                onSelect={setTimeSlot}
              />
              {/* Venue */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Venue</Text>
                {venue ? (
                  <View style={styles.venueSelected}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.venueSelectedName}>{venue.name}</Text>
                      {venue.city ? <Text style={styles.venueSelectedCity}>{venue.city}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => setVenue(null)}>
                      <MaterialCommunityIcons name="close" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.selectBox} activeOpacity={0.7} onPress={() => setVenueModalVisible(true)}>
                    <Text style={[styles.selectText, { color: TEXT_LIGHT }]}>Search or select venue...</Text>
                    <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.TEXT_MUTED} />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Match Type</Text>
                <View style={styles.toggleRow}>
                  {MATCH_TYPES.map((type) => {
                    const active = matchType === type;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                        onPress={() => setMatchType(type)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{type}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.scheduleBtn, saving && { opacity: 0.6 }]}
                onPress={handleCreateMatch}
                disabled={saving}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={16} color={COLORS.ACCENT} />
                <Text style={styles.scheduleBtnText}>
                  {saving ? 'Creating...' : 'Create Match'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Calendar for fixture dates */}
      <CalendarPicker
        visible={calendarMatchId !== null}
        onClose={() => setCalendarMatchId(null)}
        value={calendarMatchId ? (fixtureSchedule[calendarMatchId]?.match_date || '') : ''}
        onSelect={(date) => {
          if (calendarMatchId) updateFixtureField(calendarMatchId, 'match_date', date);
        }}
      />

      {/* Venue search modal */}
      <Modal visible={venueModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setVenueModalVisible(false); setVenueSearch(''); setVenueSearchResults([]); setPendingVenueLoc(null); }}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Venue</Text>

            {pendingVenueLoc ? (
              <View>
                <View style={{ backgroundColor: COLORS.ACCENT_SOFT, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.ACCENT_SOFT_BORDER }}>
                  <Text style={{ fontSize: 12, color: COLORS.ACCENT, marginBottom: 2 }}><MaterialCommunityIcons name="check" size={12} color={COLORS.ACCENT} /> Location selected</Text>
                  <Text style={{ fontSize: 13, color: TEXT_DARK, lineHeight: 18 }} numberOfLines={2}>{pendingVenueLoc.display_name}</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: TEXT_DARK, marginBottom: 6 }}>Venue Name</Text>
                <TextInput
                  style={{ height: 44, backgroundColor: COLORS.SURFACE, borderRadius: 8, borderWidth: 1.5, borderColor: PRIMARY, paddingHorizontal: 14, fontSize: 15, color: TEXT_DARK }}
                  value={venueNameInput}
                  onChangeText={setVenueNameInput}
                  placeholder="e.g. Wankhede Stadium"
                  placeholderTextColor={TEXT_LIGHT}
                  autoFocus
                />
                <Text style={{ fontSize: 11, color: TEXT_LIGHT, marginTop: 4, marginBottom: 12 }}>Give this venue a short name (or keep the default)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => { setPendingVenueLoc(null); setVenueNameInput(''); }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: TEXT_DARK }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                    onPress={confirmVenueCreate}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Add Venue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <View style={{ marginBottom: 12 }}>
                  <TextInput
                    style={{ height: 44, backgroundColor: COLORS.SURFACE, borderRadius: 8, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14, fontSize: 14, color: TEXT_DARK }}
                    value={venueSearch}
                    onChangeText={handleVenueSearchChange}
                    placeholder="Search location (e.g. Mumbai, Wankhede)..."
                    placeholderTextColor={TEXT_LIGHT}
                    autoFocus
                  />
                  {venueSearching && <Text style={{ position: 'absolute', right: 12, top: 14, fontSize: 12, color: TEXT_LIGHT }}>...</Text>}
                </View>
                <CurrentLocationButton onLocation={(loc) => {
                  selectVenueFromSearch({
                    display_name: loc.displayName,
                    city: loc.city,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  });
                }} style={{ marginBottom: 10 }} />

                {venueSearchResults.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 4 }}>SEARCH RESULTS</Text>
                    <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {venueSearchResults.map((item, i) => (
                        <TouchableOpacity
                          key={i}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER }}
                          onPress={() => selectVenueFromSearch(item)}
                        >
                          <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
                          <Text style={{ flex: 1, fontSize: 13, color: TEXT_DARK, lineHeight: 18 }} numberOfLines={2}>{item.display_name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {venues.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: TEXT_LIGHT, marginBottom: 4 }}>YOUR VENUES</Text>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {venues.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.modalOption, venue?.id === item.id && styles.modalOptionActive]}
                          onPress={() => { setVenue(item); setVenueModalVisible(false); setVenueSearch(''); setVenueSearchResults([]); }}
                        >
                          <Text style={[styles.modalOptionText, venue?.id === item.id && { color: PRIMARY, fontWeight: '700' }]}>
                            {item.name}
                          </Text>
                          {item.city ? <Text style={{ fontSize: 11, color: TEXT_LIGHT }}>{item.city}</Text> : null}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <TouchableOpacity style={styles.modalCancel} onPress={() => { setVenueModalVisible(false); setVenueSearch(''); setVenueSearchResults([]); }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.RED }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* ─── Time slot picker inline ─── */
const TimeSlotPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.scheduleField} onPress={() => setOpen(true)}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.TEXT_MUTED} />
        <Text style={[styles.scheduleFieldText, !value && { color: TEXT_LIGHT }]}>
          {value || 'Set Time'}
        </Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Time Slot</Text>
            {TIME_SLOTS.map(slot => (
              <TouchableOpacity
                key={slot}
                style={[styles.modalOption, value === slot && styles.modalOptionActive]}
                onPress={() => { onChange(slot); setOpen(false); }}
              >
                <Text style={[styles.modalOptionText, value === slot && { color: PRIMARY, fontWeight: '700' }]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

/* ========== STYLES ========== */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  centerView: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.CARD,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.SURFACE,
  },
  headerBackIcon: { fontSize: 24, color: TEXT_DARK, marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT_DARK },

  /* View toggle */
  viewToggle: {
    flexDirection: 'row', backgroundColor: COLORS.CARD, paddingHorizontal: 16,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER, gap: 8,
  },
  viewToggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', backgroundColor: COLORS.SURFACE,
  },
  viewToggleBtnActive: { backgroundColor: COLORS.ACCENT },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: TEXT_MID },
  viewToggleTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  /* Stage section */
  stageSection: { marginBottom: 24 },
  stageHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 12,
  },
  stageName: { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  stageCount: { fontSize: 12, color: TEXT_LIGHT, marginTop: 2 },
  saveScheduleBtn: {
    backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  saveScheduleBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  /* Fixture card */
  fixtureCard: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 14, marginBottom: 10,
  },
  fixtureTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  matchNumBadge: {
    backgroundColor: COLORS.SURFACE, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  matchNumText: { fontSize: 11, fontWeight: '700', color: TEXT_MID },
  groupBadge: {
    backgroundColor: COLORS.INFO_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  groupBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.INFO },
  statusDot: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  statusDotText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  /* Teams row in fixture */
  fixtureTeamsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  fixtureTeam: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  teamFlag: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  teamFlagText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  fixtureTeamName: { fontSize: 14, fontWeight: '600', color: TEXT_DARK, flex: 1 },
  fixtureVs: { fontSize: 12, fontWeight: '700', color: TEXT_LIGHT },
  fixtureResult: { fontSize: 12, color: COLORS.SUCCESS, fontWeight: '600', textAlign: 'center', marginTop: 8 },

  /* Schedule controls */
  scheduleControls: {
    flexDirection: 'row', gap: 8, marginTop: 10, borderTopWidth: 1,
    borderTopColor: COLORS.BORDER, paddingTop: 10,
  },
  scheduleField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.SURFACE, borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  scheduleFieldIcon: { fontSize: 14 },
  scheduleFieldText: { fontSize: 12, fontWeight: '600', color: TEXT_DARK, flex: 1 },

  /* Empty */
  emptyWrap: {
    backgroundColor: COLORS.CARD, borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    padding: 40, alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_DARK, marginBottom: 8 },
  emptyText: { fontSize: 14, color: TEXT_LIGHT, textAlign: 'center', lineHeight: 20 },

  /* Create match form */
  pageTitle: { fontSize: 22, fontWeight: '700', color: TEXT_DARK },
  pageSubtitle: { fontSize: 14, color: TEXT_LIGHT, marginTop: 4, marginBottom: 20, lineHeight: 20 },
  card: {
    backgroundColor: COLORS.CARD, borderRadius: 16, borderWidth: 1,
    borderColor: BORDER, padding: 24,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: TEXT_MID, marginBottom: 6 },
  selectBox: {
    height: 48, backgroundColor: COLORS.SURFACE, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: TEXT_DARK, flex: 1 },
  chevron: { fontSize: 14, color: TEXT_LIGHT, marginLeft: 8 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: BORDER, backgroundColor: COLORS.SURFACE,
  },
  toggleBtnActive: { backgroundColor: PRIMARY_20, borderColor: PRIMARY },
  toggleText: { fontSize: 14, fontWeight: '600', color: TEXT_MID },
  toggleTextActive: { color: COLORS.ACCENT_LIGHT, fontWeight: '700' },
  scheduleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, backgroundColor: PRIMARY, borderRadius: 14, marginTop: 8,
  },
  scheduleBtnIcon: { fontSize: 18, color: '#fff', marginRight: 8, fontWeight: '700' },
  scheduleBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  /* Modal */
  modalOverlay: {
    flex: 1, backgroundColor: COLORS.OVERLAY,
    justifyContent: 'center', paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: COLORS.CARD, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 16,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: TEXT_DARK, marginBottom: 12, paddingHorizontal: 4 },
  searchModeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchModeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: BORDER,
  },
  searchModeBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  searchModeText: { fontSize: 12, fontWeight: '600', color: TEXT_LIGHT },
  searchModeTextActive: { color: '#fff' },
  searchInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.SURFACE, borderRadius: 10, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: TEXT_DARK },
  modalOption: {
    paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  modalOptionActive: { backgroundColor: PRIMARY_20, borderRadius: 8 },
  modalOptionText: { fontSize: 15, color: TEXT_DARK },
  modalCancel: { marginTop: 12, alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.RED },

  /* Calendar picker */
  calendarWrap: {
    backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  calHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  calNavBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE, alignItems: 'center', justifyContent: 'center' },
  calNavText: { fontSize: 12, color: TEXT_MID },
  calMonthYear: { fontSize: 16, fontWeight: '700', color: TEXT_DARK },
  calRow: { flexDirection: 'row' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center',
  },
  calCellSelected: { backgroundColor: PRIMARY, borderRadius: 20 },
  calCellToday: { borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 20 },
  calDayHeader: { fontSize: 11, fontWeight: '700', color: TEXT_LIGHT, textTransform: 'uppercase' },
  calDayText: { fontSize: 14, fontWeight: '500', color: TEXT_DARK },
  calDayTextSelected: { color: '#fff', fontWeight: '700' },
  calDayTextToday: { color: PRIMARY, fontWeight: '700' },
  calFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  calTodayBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  calTodayText: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  calCancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  calCancelText: { fontSize: 14, fontWeight: '600', color: COLORS.RED },

  /* Overs selector */
  oversRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  oversBtn: {
    minWidth: 38, height: 36, borderRadius: 8, backgroundColor: COLORS.SURFACE,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
    borderWidth: 1.5, borderColor: BORDER,
  },
  oversBtnActive: { backgroundColor: PRIMARY_20, borderColor: PRIMARY },
  oversBtnText: { fontSize: 14, fontWeight: '700', color: TEXT_MID },
  oversBtnTextActive: { color: COLORS.ACCENT_LIGHT },
  customOversRow: {
    flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center',
  },
  customOversInput: {
    flex: 1, height: 44, backgroundColor: COLORS.SURFACE, borderRadius: 8,
    borderWidth: 1, borderColor: BORDER, paddingHorizontal: 14,
    fontSize: 15, color: TEXT_DARK,
  },
  customOversOk: {
    backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 20, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  customOversOkText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  /* Venue */
  venueSelected: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.ACCENT_SOFT,
    borderWidth: 1.5, borderColor: PRIMARY, borderRadius: 8, padding: 12,
  },
  venueSelectedName: { fontSize: 14, fontWeight: '700', color: TEXT_DARK },
  venueSelectedCity: { fontSize: 11, color: TEXT_MID, marginTop: 2 },
});

export default CreateMatchScreen;
