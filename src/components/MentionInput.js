import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../theme';
import { useMentionSearch } from '../hooks/useUsers';
import Avatar from './Avatar';

/**
 * TextInput with @mention autocomplete.
 * When user types @, shows a dropdown of matching users.
 * Uses React Query for caching and automatic request cancellation.
 */
const MentionInput = ({ value, onChangeText, placeholder, style, multiline = true, autoFocus = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [debouncedMention, setDebouncedMention] = useState('');
  const inputRef = useRef(null);

  // Debounce mention query (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMention(mentionQuery), 300);
    return () => clearTimeout(t);
  }, [mentionQuery]);

  // React Query: auto-cached (30s), auto-cancels stale requests
  const { data: suggestions = [], isLoading: loading } = useMentionSearch(debouncedMention, {
    enabled: showDropdown,
  });

  const handleTextChange = useCallback((text) => {
    onChangeText(text);

    const lastAt = text.lastIndexOf('@');
    if (lastAt === -1) {
      setShowDropdown(false);
      return;
    }

    const afterAt = text.substring(lastAt + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) {
      setShowDropdown(false);
      return;
    }

    setMentionQuery(afterAt.toLowerCase());
    setShowDropdown(true);
  }, [onChangeText]);

  const selectUser = useCallback((selectedUser) => {
    const username = selectedUser.username || selectedUser.full_name?.toLowerCase().replace(/\s/g, '_') || 'user';
    const lastAt = value.lastIndexOf('@');
    if (lastAt === -1) return;

    // Replace @query with @username + space
    const before = value.substring(0, lastAt);
    const newText = `${before}@${username} `;
    onChangeText(newText);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [value, onChangeText]);

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestion}
      onPress={() => selectUser(item)}
      activeOpacity={0.7}
    >
      <Avatar
        uri={item.profile}
        name={item.full_name}
        size={32}
        color={COLORS.ACCENT}
      />
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName} numberOfLines={1}>{item.full_name}</Text>
        {item.username && (
          <Text style={styles.suggestionUsername}>@{item.username}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Suggestions dropdown — shows ABOVE the input */}
      {showDropdown && (suggestions.length > 0 || loading) && (
        <View style={styles.dropdown}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={COLORS.ACCENT} />
              <Text style={styles.loadingText}>Searching users...</Text>
            </View>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderSuggestion}
              keyboardShouldPersistTaps="always"
              style={styles.suggestionList}
              nestedScrollEnabled
            />
          )}
        </View>
      )}

      <TextInput
        ref={inputRef}
        style={[styles.input, style]}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.TEXT_MUTED}
        multiline={multiline}
        autoFocus={autoFocus}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  input: {
    fontSize: 14,
    color: COLORS.TEXT,
    maxHeight: 80,
  },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    maxHeight: 220,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  suggestionList: {
    maxHeight: 220,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.BORDER,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  suggestionUsername: {
    fontSize: 11,
    color: COLORS.ACCENT,
    fontWeight: '500',
    marginTop: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.TEXT_MUTED,
  },
});

export default React.memo(MentionInput);
