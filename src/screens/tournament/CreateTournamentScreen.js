import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert,
  Platform, Modal, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { tournamentsAPI, venuesAPI } from '../../services/api';
import { useAuthGate } from '../../hooks/useRequireAuth';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import CurrentLocationButton from '../../components/CurrentLocationButton';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/* ── Custom Calendar Picker (works on web + native) ── */
const CalendarPicker = ({ visible, onClose, value, onSelect, minDate }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initial = value || (minDate && minDate > today ? minDate : today);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value || (minDate && minDate > today ? minDate : new Date());
      setYear(d.getFullYear());
      setMonth(d.getMonth());
    }
  }, [visible]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Determine minimum selectable date
  const minD = minDate ? new Date(minDate) : today;
  minD.setHours(0, 0, 0, 0);

  const isDayDisabled = (day) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d < minD;
  };

  // Prevent navigating to months entirely before minDate
  const canGoPrev = () => {
    if (month === 0) return new Date(year - 1, 11, 1) >= new Date(minD.getFullYear(), minD.getMonth(), 1);
    return new Date(year, month - 1, 1) >= new Date(minD.getFullYear(), minD.getMonth(), 1);
  };

  const prevMonth = () => {
    if (!canGoPrev()) return;
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day) => {
    if (isDayDisabled(day)) return;
    onSelect(new Date(year, month, day));
    onClose();
  };

  const selectedDay = value ? value.getDate() : null;
  const selectedMonth = value ? value.getMonth() : null;
  const selectedYear = value ? value.getFullYear() : null;
  const nowDate = new Date();
  const todayDate = nowDate.getDate();
  const todayMonth = nowDate.getMonth();
  const todayYear = nowDate.getFullYear();
  const isTodayDisabled = isDayDisabled(todayDate) || todayMonth !== month || todayYear !== year;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={calStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={calStyles.wrap} onStartShouldSetResponder={() => true}>
          <View style={calStyles.header}>
            <TouchableOpacity onPress={prevMonth} style={[calStyles.navBtn, !canGoPrev() && { opacity: 0.3 }]} disabled={!canGoPrev()}>
              <Text style={calStyles.navText}>{'\u25C0'}</Text>
            </TouchableOpacity>
            <Text style={calStyles.monthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn}>
              <Text style={calStyles.navText}>{'\u25B6'}</Text>
            </TouchableOpacity>
          </View>
          <View style={calStyles.row}>
            {DAYS.map(d => (
              <View key={d} style={calStyles.cell}>
                <Text style={calStyles.dayHeader}>{d}</Text>
              </View>
            ))}
          </View>
          <View style={calStyles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e${i}`} style={calStyles.cell} />;
              const disabled = isDayDisabled(day);
              const isSel = day === selectedDay && month === selectedMonth && year === selectedYear;
              const isToday = day === todayDate && month === todayMonth && year === todayYear;
              return (
                <TouchableOpacity
                  key={i}
                  style={[calStyles.cell, isSel && calStyles.cellSelected, isToday && !isSel && calStyles.cellToday, disabled && { opacity: 0.25 }]}
                  onPress={() => selectDay(day)}
                  disabled={disabled}
                >
                  <Text style={[calStyles.dayText, isSel && calStyles.dayTextSelected, isToday && !isSel && calStyles.dayTextToday]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={calStyles.footer}>
            {!isTodayDisabled ? (
              <TouchableOpacity onPress={() => { setMonth(todayMonth); setYear(todayYear); selectDay(todayDate); }}>
                <Text style={calStyles.todayText}>Today</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity onPress={onClose}>
              <Text style={calStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const calStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'center', paddingHorizontal: 30 },
  wrap: { backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.BORDER },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 12, color: COLORS.TEXT_SECONDARY },
  monthYear: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: COLORS.ACCENT, borderRadius: 20 },
  cellToday: { borderWidth: 1.5, borderColor: COLORS.ACCENT, borderRadius: 20 },
  dayHeader: { fontSize: 11, fontWeight: '700', color: COLORS.TEXT_MUTED, textTransform: 'uppercase' },
  dayText: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
  dayTextToday: { color: COLORS.ACCENT, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 4 },
  todayText: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT, paddingVertical: 8 },
  cancelText: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT_LIGHT, paddingVertical: 8 },
});

const CreateTournamentScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  useAuthGate('create a tournament');
  const toast = useToast();

  // Form state (preserved from original)
  const [name, setName] = useState('');
  const [organizerName, setOrganizerName] = useState('');
  const [tournamentType, setTournamentType] = useState('open'); // 'open' | 'invite'
  const [startDateObj, setStartDateObj] = useState(null);
  const [endDateObj, setEndDateObj] = useState(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [location, setLocation] = useState('');
  const [locationCoords, setLocationCoords] = useState(null); // { latitude, longitude, city }
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [entryFee, setEntryFee] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [loading, setLoading] = useState(false);
  const [bannerUri, setBannerUri] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Match format
  const [matchFormat, setMatchFormat] = useState('T20');
  const [customOvers, setCustomOvers] = useState('');
  const [ballType, setBallType] = useState('tennis');

  const formatDateDisplay = (d) => {
    if (!d) return '';
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Location search with debounce
  const locationTimerRef = React.useRef(null);
  const handleLocationChange = (text) => {
    setLocation(text);
    setLocationCoords(null);
    if (locationTimerRef.current) clearTimeout(locationTimerRef.current);
    if (text.length < 3) { setLocationResults([]); return; }
    locationTimerRef.current = setTimeout(async () => {
      setLocationSearching(true);
      try {
        const res = await venuesAPI.searchLocation(text);
        setLocationResults(res.data || []);
      } catch { setLocationResults([]); }
      setLocationSearching(false);
    }, 500);
  };

  const selectLocation = (loc) => {
    setLocation(loc.display_name);
    setLocationCoords({ latitude: loc.latitude, longitude: loc.longitude, city: loc.city });
    setLocationResults([]);
  };

  const formatDateForAPI = (d) => {
    if (!d) return undefined;
    return d.toISOString().split('T')[0];
  };

  const pickBanner = async () => {
    Alert.alert('Tournament Banner', 'Choose an option', [
      { text: 'Take Photo', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return toast.warning('Permission needed', 'Camera access is required');
        const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [2, 1], quality: 0.7 });
        if (!result.canceled && result.assets?.[0]?.uri) setBannerUri(result.assets[0].uri);
      }},
      { text: 'Choose from Gallery', onPress: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [2, 1], quality: 0.7 });
        if (!result.canceled && result.assets?.[0]?.uri) setBannerUri(result.assets[0].uri);
      }},
      ...(bannerUri ? [{ text: 'Remove Banner', style: 'destructive', onPress: () => setBannerUri(null) }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadBanner = async () => {
    if (!bannerUri) return null;

    // Compress banner before upload
    let compressedUri = bannerUri;
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const result = await ImageManipulator.manipulateAsync(
        bannerUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );
      compressedUri = result.uri;
    } catch {}

    // Upload to backend server
    const { default: api } = require('../../services/api');
    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: `banner_${Date.now()}.jpg`,
    });
    const res = await api.post('/api/community/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.image_url;
  };

  const handleCreate = async () => {
    if (!name.trim()) return toast.warning('Tournament name is required');
    if (!organizerName.trim()) return toast.warning('Organizer name is required');
    if (!startDateObj) return toast.warning('Start date is required');
    if (!endDateObj) return toast.warning('End date is required');
    if (!location.trim()) return toast.warning('Location is required');
    if (matchFormat === 'Custom' && (!customOvers || parseInt(customOvers) < 1)) return toast.warning('Enter valid number of overs');
    setLoading(true);
    try {
      const oversMap = { T5: 5, T10: 10, T20: 20 };
      const overs = matchFormat === 'Custom' ? (parseInt(customOvers, 10) || 20) : (oversMap[matchFormat] || 20);
      let bannerUrl = null;
      if (bannerUri) {
        setUploadingBanner(true);
        bannerUrl = await uploadBanner();
        setUploadingBanner(false);
      }
      const res = await tournamentsAPI.create({
        name: name.trim(),
        tournament_type: 'league_knockout',
        overs_per_match: overs,
        ball_type: ballType,
        organizer_name: organizerName.trim() || undefined,
        start_date: formatDateForAPI(startDateObj),
        end_date: formatDateForAPI(endDateObj),
        location: location.trim() || undefined,
        entry_fee: parseFloat(entryFee) || 0,
        prize_pool: parseFloat(prizePool) || 0,
        banner_url: bannerUrl || undefined,
      });
      toast.success('Tournament created! Now let\'s set it up.');
      navigation.replace('TournamentSetup', {
        tournamentId: res.data.id,
        tournamentName: name.trim(),
        existingTeams: [],
      });
    } catch (e) {
      toast.error('Failed', e.response?.data?.detail || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const renderSectionLabel = (label) => (
    <Text style={styles.sectionLabel}>{label}</Text>
  );

  const renderLabel = (label, required = true) => (
    <Text style={styles.inputLabel}>{label}{required && <Text style={{ color: COLORS.DANGER }}> *</Text>}</Text>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />

        <Text style={styles.headerTitle}>Create Tournament</Text>

        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.draftsBtn}>Drafts</Text>
        </TouchableOpacity>
      </View>

      {/* ===== SCROLLABLE FORM ===== */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ---- MEDIA ---- */}
        {renderSectionLabel('MEDIA')}
        <TouchableOpacity style={styles.bannerUpload} activeOpacity={0.7} onPress={pickBanner}>
          {bannerUri ? (
            <View>
              <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
              <View style={styles.bannerEditOverlay}>
                <Feather name="edit-2" size={16} color="#fff" />
                <Text style={styles.bannerEditText}>Change Banner</Text>
              </View>
              {uploadingBanner && (
                <View style={styles.bannerLoadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Uploading...</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.bannerOverlay}>
              <Feather name="camera" size={32} color={COLORS.TEXT_MUTED} />
              <Text style={styles.bannerText}>Upload Tournament Banner</Text>
              <Text style={styles.bannerSubtext}>Tap to select from gallery or camera</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ---- BASIC INFORMATION ---- */}
        {renderSectionLabel('BASIC INFORMATION')}

        {renderLabel('Tournament Name')}
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Champions Cricket League 2024"
          placeholderTextColor={COLORS.TEXT_MUTED}
        />

        {renderLabel('Organizer Name')}
        <TextInput
          style={styles.input}
          value={organizerName}
          onChangeText={setOrganizerName}
          placeholder="Individual or Club Name"
          placeholderTextColor={COLORS.TEXT_MUTED}
        />

        {renderLabel('Tournament Type')}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tournamentType === 'open' && styles.toggleBtnActive,
            ]}
            onPress={() => setTournamentType('open')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="earth" size={16} color={tournamentType === 'open' ? COLORS.ACCENT : COLORS.TEXT_MUTED} />
            <Text style={[styles.toggleText, tournamentType === 'open' && styles.toggleTextActive]}>
              Open
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tournamentType === 'invite' && styles.toggleBtnActive,
            ]}
            onPress={() => setTournamentType('invite')}
            activeOpacity={0.7}
          >
            <Feather name="lock" size={16} color={tournamentType === 'invite' ? COLORS.ACCENT : COLORS.TEXT_MUTED} />
            <Text style={[styles.toggleText, tournamentType === 'invite' && styles.toggleTextActive]}>
              Invite-only
            </Text>
          </TouchableOpacity>
        </View>

        {renderLabel('Match Format')}
        <View style={styles.toggleRow}>
          {['T5', 'T10', 'T20', 'Custom'].map(fmt => (
            <TouchableOpacity
              key={fmt}
              style={[styles.toggleBtn, matchFormat === fmt && styles.toggleBtnActive]}
              onPress={() => setMatchFormat(fmt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, matchFormat === fmt && styles.toggleTextActive]}>{fmt}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {matchFormat === 'Custom' && (
          <>
            {renderLabel('Number of Overs')}
            <TextInput
              style={styles.input}
              value={customOvers}
              onChangeText={setCustomOvers}
              placeholder="e.g. 15"
              placeholderTextColor={COLORS.TEXT_MUTED}
              keyboardType="numeric"
            />
          </>
        )}

        {renderLabel('Ball Type')}
        <View style={styles.toggleRow}>
          {['tennis', 'leather', 'rubber'].map(bt => (
            <TouchableOpacity
              key={bt}
              style={[styles.toggleBtn, ballType === bt && styles.toggleBtnActive]}
              onPress={() => setBallType(bt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, ballType === bt && styles.toggleTextActive]}>
                {bt.charAt(0).toUpperCase() + bt.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ---- SCHEDULE & LOCATION ---- */}
        {renderSectionLabel('SCHEDULE & LOCATION')}

        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            {renderLabel('Start Date')}
            <TouchableOpacity
              style={styles.inputWithIcon}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
              <Text style={[styles.inputInner, { lineHeight: 48 }, !startDateObj && { color: COLORS.TEXT_MUTED }]}>
                {startDateObj ? formatDateDisplay(startDateObj) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.gridCol}>
            {renderLabel('End Date')}
            <TouchableOpacity
              style={styles.inputWithIcon}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar" size={18} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
              <Text style={[styles.inputInner, { lineHeight: 48 }, !endDateObj && { color: COLORS.TEXT_MUTED }]}>
                {endDateObj ? formatDateDisplay(endDateObj) : 'Select date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Pickers */}
        <CalendarPicker
          visible={showStartPicker}
          onClose={() => setShowStartPicker(false)}
          value={startDateObj}
          minDate={new Date()}
          onSelect={(d) => {
            setStartDateObj(d);
            // If end date is before new start date, clear it
            if (endDateObj && endDateObj <= d) setEndDateObj(null);
          }}
        />
        <CalendarPicker
          visible={showEndPicker}
          onClose={() => setShowEndPicker(false)}
          value={endDateObj}
          minDate={startDateObj ? new Date(startDateObj.getTime() + 86400000) : new Date()}
          onSelect={(d) => setEndDateObj(d)}
        />

        {renderLabel('Ground / Location')}
        <View style={{ zIndex: 10 }}>
          <View style={styles.inputWithIcon}>
            <MaterialCommunityIcons name="map-marker" size={18} color={COLORS.ACCENT} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.inputInner}
              value={location}
              onChangeText={handleLocationChange}
              placeholder="Search location (e.g. Mumbai, Wankhede)"
              placeholderTextColor={COLORS.TEXT_MUTED}
            />
            {locationSearching && <Text style={{ position: 'absolute', right: 12, top: 12, fontSize: 12, color: COLORS.TEXT_MUTED }}>...</Text>}
          </View>
          <CurrentLocationButton onLocation={(loc) => {
            setLocation(loc.displayName);
            setLocationCoords({ latitude: loc.latitude, longitude: loc.longitude, city: loc.city });
            setLocationResults([]);
          }} />
          {locationCoords && (
            <Text style={{ fontSize: 11, color: COLORS.ACCENT, marginTop: 2, marginLeft: 4 }}>
              <MaterialCommunityIcons name="check" size={11} color={COLORS.ACCENT} /> Location set ({locationCoords.city || 'coordinates saved'})
            </Text>
          )}
          {locationResults.length > 0 && (
            <View style={styles.locationDropdown}>
              {locationResults.map((loc, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.locationItem}
                  onPress={() => selectLocation(loc)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="map-marker" size={14} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
                  <Text style={styles.locationItemText} numberOfLines={2}>{loc.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ---- FEES & REWARDS ---- */}
        {renderSectionLabel('FEES & REWARDS')}

        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            {renderLabel('Entry Fee', false)}
            <View style={styles.inputWithIcon}>
              <Text style={styles.dollarPrefix}>₹</Text>
              <TextInput
                style={styles.inputInner}
                value={entryFee}
                onChangeText={setEntryFee}
                placeholder="0"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.gridCol}>
            {renderLabel('Prize Pool', false)}
            <View style={styles.inputWithIcon}>
              <Text style={styles.dollarPrefix}>₹</Text>
              <TextInput
                style={styles.inputInner}
                value={prizePool}
                onChangeText={setPrizePool}
                placeholder="0"
                placeholderTextColor={COLORS.TEXT_MUTED}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        {/* Bottom spacer for fixed button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ===== FIXED BOTTOM BUTTON ===== */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>
            {loading ? 'Creating...' : 'Create Tournament'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.CARD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SURFACE,
  },
  backArrow: {
    fontSize: 20,
    color: COLORS.TEXT,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  draftsBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ACCENT,
  },

  /* ── Scroll ── */
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  /* ── Section label ── */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 12,
  },

  /* ── Input label ── */
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },

  /* ── Banner upload ── */
  bannerUpload: {
    width: '100%',
    height: 192,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  bannerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  bannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  bannerSubtext: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
  },
  bannerImage: {
    width: '100%',
    height: 192,
  },
  bannerEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bannerEditText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bannerLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Inputs ── */
  input: {
    height: 48,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.TEXT,
    marginBottom: 16,
  },
  inputWithIcon: {
    height: 48,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputIconLeft: {
    fontSize: 18,
    marginRight: 8,
    color: COLORS.TEXT_MUTED,
  },
  dollarPrefix: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    marginRight: 4,
  },
  inputInner: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: COLORS.TEXT,
  },

  /* ── Toggle buttons ── */
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.CARD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toggleBtnActive: {
    borderWidth: 2,
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  toggleIcon: {
    fontSize: 16,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  toggleTextActive: {
    color: COLORS.ACCENT,
  },

  /* ── Grid ── */
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },

  /* ── Bottom bar ── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.BG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  createBtn: {
    backgroundColor: COLORS.ACCENT,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ── Location autocomplete ── */
  locationDropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    maxHeight: 200,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
      default: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    }),
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.BORDER,
  },
  locationItemIcon: {
    fontSize: 14,
    marginRight: 8,
    color: COLORS.TEXT_MUTED,
  },
  locationItemText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.TEXT,
    lineHeight: 18,
  },
});

export default CreateTournamentScreen;
