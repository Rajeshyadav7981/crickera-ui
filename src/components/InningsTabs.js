import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../theme';

const InningsTabs = ({ tabs = [], activeIndex = 0, onChange, style }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={[styles.container, style]}
  >
    {tabs.map((tab, i) => {
      const active = i === activeIndex;
      return (
        <TouchableOpacity
          key={tab.key || i}
          style={[styles.tab, active && styles.tabActive]}
          onPress={() => onChange?.(i)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, active && styles.tabTextActive]}>
            {tab.shortLabel || tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE,
  },
  tabActive: { backgroundColor: COLORS.ACCENT },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },
  tabTextActive: { color: COLORS.TEXT, fontWeight: '700' },
});

export default React.memo(InningsTabs);
