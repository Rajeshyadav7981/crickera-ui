import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
const parseISO = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const [y, m, d] = String(s).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const atMidnight = (d) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };

/**
 * Reusable calendar picker — tap-to-change-year, min/max date support.
 *
 * Props:
 *   visible, onClose
 *   value: 'YYYY-MM-DD' string OR Date OR null
 *   onSelect: (value) — emits SAME type as value (string → string, Date → Date)
 *   minDate / maxDate: 'YYYY-MM-DD' string OR Date (both optional)
 *   returnType: 'string' (default) | 'date' — override output format
 */
const CalendarPicker = ({ visible, onClose, value, onSelect, minDate, maxDate, returnType }) => {
  const today = atMidnight(new Date());
  const minD = minDate ? atMidnight(parseISO(minDate)) : null;
  const maxD = maxDate ? atMidnight(parseISO(maxDate)) : null;
  const isDateType = returnType === 'date' || value instanceof Date;

  const initial = parseISO(value) || (minD && minD > today ? minD : (maxD && maxD < today ? maxD : today));
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      const d = parseISO(value) || (minD && minD > today ? minD : (maxD && maxD < today ? maxD : new Date()));
      setYear(d.getFullYear());
      setMonth(d.getMonth());
      setYearPickerOpen(false);
      setMonthPickerOpen(false);
    }
  }, [visible]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isDayDisabled = (day) => {
    const d = atMidnight(new Date(year, month, day));
    if (minD && d < minD) return true;
    if (maxD && d > maxD) return true;
    return false;
  };

  const canGoPrev = () => {
    if (!minD) return true;
    const prev = month === 0 ? new Date(year - 1, 11, 1) : new Date(year, month - 1, 1);
    return prev >= new Date(minD.getFullYear(), minD.getMonth(), 1);
  };
  const canGoNext = () => {
    if (!maxD) return true;
    const next = month === 11 ? new Date(year + 1, 0, 1) : new Date(year, month + 1, 1);
    return next <= new Date(maxD.getFullYear(), maxD.getMonth(), 1);
  };

  const prevMonth = () => {
    if (!canGoPrev()) return;
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (!canGoNext()) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const selectDay = (day) => {
    if (isDayDisabled(day)) return;
    const picked = new Date(year, month, day);
    onSelect(isDateType ? picked : toISO(picked));
    onClose();
  };

  // Year list: minDate year → maxDate year (or fallback)
  const years = useMemo(() => {
    const minY = minD ? minD.getFullYear() : 1950;
    const maxY = maxD ? maxD.getFullYear() : today.getFullYear() + 10;
    const arr = [];
    for (let y = maxY; y >= minY; y--) arr.push(y);
    return arr;
  }, [minD?.getTime(), maxD?.getTime()]);

  const isMonthDisabled = (m) => {
    if (minD && (year < minD.getFullYear() || (year === minD.getFullYear() && m < minD.getMonth()))) return true;
    if (maxD && (year > maxD.getFullYear() || (year === maxD.getFullYear() && m > maxD.getMonth()))) return true;
    return false;
  };

  const sel = parseISO(value);
  const selDay = sel?.getDate();
  const selMonth = sel?.getMonth();
  const selYear = sel?.getFullYear();

  const jumpToday = () => {
    if (minD && today < minD) return;
    if (maxD && today > maxD) return;
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    selectDay(today.getDate());
  };
  const todayInRange = !((minD && today < minD) || (maxD && today > maxD));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.wrap} onStartShouldSetResponder={() => true}>
          {/* Header — tap month/year to quick-jump */}
          <View style={s.header}>
            <TouchableOpacity onPress={prevMonth} style={[s.navBtn, !canGoPrev() && { opacity: 0.3 }]} disabled={!canGoPrev()}>
              <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.TEXT} />
            </TouchableOpacity>
            <View style={s.headerCenter}>
              <TouchableOpacity onPress={() => setMonthPickerOpen(true)} activeOpacity={0.7}>
                <Text style={s.monthText}>{MONTHS[month]}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setYearPickerOpen(true)} activeOpacity={0.7}>
                <Text style={s.yearText}>{year}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={nextMonth} style={[s.navBtn, !canGoNext() && { opacity: 0.3 }]} disabled={!canGoNext()}>
              <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.TEXT} />
            </TouchableOpacity>
          </View>

          {/* Year picker overlay */}
          {yearPickerOpen && (
            <ScrollView style={s.pickerScroll} showsVerticalScrollIndicator={false}>
              <View style={s.yearGrid}>
                {years.map(y => (
                  <TouchableOpacity
                    key={y}
                    style={[s.yearCell, y === year && s.yearCellActive]}
                    onPress={() => { setYear(y); setYearPickerOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.yearCellText, y === year && s.yearCellTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Month picker overlay */}
          {monthPickerOpen && !yearPickerOpen && (
            <View style={s.monthGrid}>
              {MONTHS_SHORT.map((name, idx) => {
                const disabled = isMonthDisabled(idx);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[s.monthCell, idx === month && s.monthCellActive, disabled && { opacity: 0.3 }]}
                    onPress={() => { if (!disabled) { setMonth(idx); setMonthPickerOpen(false); } }}
                    disabled={disabled}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.monthCellText, idx === month && s.monthCellTextActive]}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Day grid */}
          {!yearPickerOpen && !monthPickerOpen && (
            <>
              <View style={s.row}>
                {DAYS.map(d => (
                  <View key={d} style={s.cell}>
                    <Text style={s.dayHeader}>{d}</Text>
                  </View>
                ))}
              </View>
              <View style={s.grid}>
                {cells.map((day, i) => {
                  if (!day) return <View key={`e${i}`} style={s.cell} />;
                  const disabled = isDayDisabled(day);
                  const isSel = day === selDay && month === selMonth && year === selYear;
                  const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[s.cell, isSel && s.cellSelected, isToday && !isSel && s.cellToday]}
                      onPress={() => selectDay(day)}
                      disabled={disabled}
                    >
                      <Text style={[
                        s.dayText,
                        isSel && s.dayTextSelected,
                        isToday && !isSel && s.dayTextToday,
                        disabled && { opacity: 0.25 },
                      ]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Footer */}
          <View style={s.footer}>
            {todayInRange && !yearPickerOpen && !monthPickerOpen ? (
              <TouchableOpacity onPress={jumpToday}>
                <Text style={s.todayText}>Today</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 30 },
  wrap: { backgroundColor: COLORS.CARD, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.BORDER, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.SURFACE, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  monthText: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT },
  yearText: { fontSize: 16, fontWeight: '700', color: COLORS.ACCENT },
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

  pickerScroll: { maxHeight: 320, marginBottom: 8 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  yearCell: { width: '25%', paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  yearCellActive: { backgroundColor: COLORS.ACCENT },
  yearCellText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  yearCellTextActive: { color: '#fff', fontWeight: '800' },

  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  monthCell: { width: '25%', paddingVertical: 14, alignItems: 'center', borderRadius: 8 },
  monthCellActive: { backgroundColor: COLORS.ACCENT },
  monthCellText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT },
  monthCellTextActive: { color: '#fff', fontWeight: '800' },
});

export default CalendarPicker;
