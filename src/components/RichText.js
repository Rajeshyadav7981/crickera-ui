import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

/**
 * RichText — renders @mentions and #hashtags as tappable colored spans.
 *
 * Usage:
 *   <RichText
 *     text="Great innings by @virat_kohli! #cricket #ipl"
 *     onMentionPress={(username) => navigate('PlayerProfile', { username })}
 *     onHashtagPress={(hashtag) => navigate('HashtagFeed', { hashtag })}
 *   />
 */

const MENTION_HASHTAG_RE = /(@[a-z0-9][a-z0-9._]{1,28}[a-z0-9]|#[a-zA-Z0-9_]{1,50})/gi;

const RichText = ({ text, style, onMentionPress, onHashtagPress, numberOfLines }) => {
  const parts = useMemo(() => {
    if (!text) return [];
    return text.split(MENTION_HASHTAG_RE).filter(Boolean);
  }, [text]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <Text
              key={i}
              style={styles.mention}
              onPress={() => onMentionPress?.(part.substring(1).toLowerCase())}
            >
              {part}
            </Text>
          );
        }
        if (part.startsWith('#')) {
          return (
            <Text
              key={i}
              style={styles.hashtag}
              onPress={() => onHashtagPress?.(part.substring(1).toLowerCase())}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
};

const styles = StyleSheet.create({
  mention: {
    color: COLORS.ACCENT,
    fontWeight: '700',
  },
  hashtag: {
    color: COLORS.ACCENT_LIGHT,
    fontWeight: '600',
  },
});

export default React.memo(RichText);
