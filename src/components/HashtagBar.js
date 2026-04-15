import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../theme';
import { communityAPI } from '../services/api';

/**
 * Horizontal scrolling bar of trending hashtags.
 * Tapping a hashtag navigates to its feed.
 */
const HashtagBar = ({ onHashtagPress, style }) => {
  const [tags, setTags] = useState([]);

  useEffect(() => {
    communityAPI.trendingHashtags()
      .then(res => setTags(res.data || []))
      .catch(() => {});
  }, []);

  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, style]}
    >
      <View style={styles.label}>
        <Text style={styles.labelText}>Trending</Text>
      </View>
      {tags.map((tag) => (
        <TouchableOpacity
          key={tag.name}
          style={styles.chip}
          onPress={() => onHashtagPress?.(tag.name)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipHash}>#</Text>
          <Text style={styles.chipText}>{tag.name}</Text>
          {tag.post_count > 1 && (
            <Text style={styles.chipCount}>{tag.post_count}</Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  label: {
    marginRight: 4,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.TEXT_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ACCENT_SOFT,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 2,
  },
  chipHash: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ACCENT,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.ACCENT_LIGHT,
  },
  chipCount: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
    marginLeft: 4,
  },
});

export default React.memo(HashtagBar);
