/**
 * SearchBar — themed search input with leading icon and clear button.
 *
 * Used in MyMatches, MyTournaments, HomeTab, CreateMatch search dropdowns.
 *
 * Props:
 *   value, onChangeText, placeholder, onClear, autoFocus, style, inputStyle
 */
import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, TYPE } from '../theme';

const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  autoFocus = false,
  style,
  inputStyle,
}) => {
  const handleClear = () => {
    if (onClear) return onClear();
    onChangeText && onChangeText('');
  };

  return (
    <View style={[styles.wrap, style]}>
      <MaterialCommunityIcons name="magnify" size={18} color={COLORS.TEXT_MUTED} />
      <TextInput
        style={[styles.input, inputStyle]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.TEXT_HINT}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {value?.length > 0 && (
        <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.TEXT_MUTED} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: SPACING.md + 2,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: TYPE.body,
    color: COLORS.TEXT,
    padding: 0,
  },
});

export default React.memo(SearchBar);
