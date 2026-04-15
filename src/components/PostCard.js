import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import Avatar from './Avatar';
import RichText from './RichText';

const { width: SW } = Dimensions.get('window');

const timeAgo = (d) => {
  if (!d) return '';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
};

const fmt = (n) => (!n ? '' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n));

const TAG_MAP = {
  'Discussion': { color: '#6366F1', icon: 'comment-text-outline' },
  'Match Update': { color: '#22C55E', icon: 'cricket' },
  'Question': { color: '#F59E0B', icon: 'help-circle-outline' },
  'Meme': { color: '#A855F7', icon: 'emoticon-happy-outline' },
  'News': { color: COLORS.RED, icon: 'newspaper-variant-outline' },
};

const PostCard = ({
  post, poll, type = 'post',
  onLike, onComment, onShare, onVote,
  onUserPress, onMentionPress, onHashtagPress, onImagePress, onMorePress,
  currentUserId, style,
}) => {
  const { id, text, title, tag, image_url, likes_count = 0, comments_count = 0, created_at, liked, user } = post || {};
  const [localLike, setLocalLike] = useState(null); // null = use prop, true/false = user toggled
  const likeScale = useRef(new Animated.Value(1)).current;

  const isLiked = localLike !== null ? localLike : !!liked;
  const likeCount = likes_count + (localLike === null ? 0 : (localLike && !liked ? 1 : !localLike && liked ? -1 : 0));

  const handleLike = useCallback(() => {
    if (!id) return;
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, friction: 3 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, friction: 5 }),
    ]).start();
    setLocalLike(prev => !(prev !== null ? prev : !!liked));
    onLike?.(id);
  }, [liked, id, onLike]);

  const userData = type === 'poll' ? poll?.user : user;
  const displayName = userData?.full_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'User';
  const postTime = type === 'poll' ? poll?.created_at : created_at;
  const isOwn = userData?.id === currentUserId;
  const tagInfo = tag ? TAG_MAP[tag] : null;

  return (
    <View style={[s.card, style]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerLeft} onPress={() => onUserPress?.(userData)} activeOpacity={0.7}>
          <Avatar uri={userData?.profile} name={displayName} size={38} color={COLORS.ACCENT} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.name} numberOfLines={1}>{displayName}</Text>
              {tagInfo && (
                <View style={[s.tag, { backgroundColor: tagInfo.color + '12' }]}>
                  <MaterialCommunityIcons name={tagInfo.icon} size={10} color={tagInfo.color} />
                  <Text style={[s.tagLabel, { color: tagInfo.color }]}>{tag}</Text>
                </View>
              )}
            </View>
            <Text style={s.time}>{timeAgo(postTime)}</Text>
          </View>
        </TouchableOpacity>
        {type === 'poll' && (
          <View style={s.pollBadge}><MaterialCommunityIcons name="poll" size={12} color="#F59E0B" /></View>
        )}
        {isOwn && onMorePress && (
          <TouchableOpacity onPress={onMorePress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialCommunityIcons name="dots-horizontal" size={20} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        )}
      </View>

      {/* Post Body */}
      {type === 'post' && (
        <View style={s.body}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          {text ? <RichText text={text} style={s.bodyText} onMentionPress={onMentionPress} onHashtagPress={onHashtagPress} numberOfLines={6} /> : null}
        </View>
      )}

      {/* Image */}
      {type === 'post' && image_url ? (
        <TouchableOpacity activeOpacity={0.95} onPress={() => onImagePress?.(image_url)} style={s.imgWrap}>
          <Image source={{ uri: image_url }} style={s.img} contentFit="cover" cachePolicy="memory-disk" transition={200} recyclingKey={image_url} />
        </TouchableOpacity>
      ) : null}

      {/* Poll */}
      {type === 'poll' && poll && <PollSection poll={poll} onVote={onVote} />}

      {/* Actions (posts only) */}
      {type === 'post' && (
        <View style={s.actionBar}>
          {/* Like */}
          <TouchableOpacity style={s.actionItem} onPress={handleLike} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <MaterialCommunityIcons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? COLORS.RED : COLORS.TEXT} />
            </Animated.View>
            {likeCount > 0 && <Text style={[s.actionLabel, isLiked && { color: COLORS.RED }]}>{fmt(likeCount)}</Text>}
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={s.actionItem} onPress={() => onComment?.(id)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chat-outline" size={24} color={COLORS.TEXT} />
            {(comments_count || 0) > 0 && <Text style={s.actionLabel}>{fmt(comments_count)}</Text>}
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={s.actionItem} onPress={() => onShare?.(id)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="share-outline" size={24} color={COLORS.TEXT} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

/* ── Poll ── */
const PollSection = ({ poll, onVote }) => {
  const total = poll.total_votes || 0;
  const myVote = poll.voted_option_id;
  const hasVoted = !!myVote;

  return (
    <View style={s.pollWrap}>
      <Text style={s.pollQ}>{poll.question}</Text>
      {(poll.options || []).map(opt => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const isMine = myVote === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[s.pollOpt, hasVoted && isMine && s.pollOptMine]}
            activeOpacity={0.8}
            onPress={() => onVote?.(poll.id, opt.id)}
          >
            {/* Animated progress bar */}
            {hasVoted && <AnimatedBar pct={pct} isMine={isMine} />}
            <View style={s.pollOptInner}>
              {hasVoted && isMine && <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.ACCENT} />}
              <Text style={[s.pollOptText, hasVoted && isMine && s.pollOptTextMine]}>{opt.text}</Text>
            </View>
            {hasVoted && <Text style={[s.pollPct, isMine && { color: COLORS.ACCENT }]}>{pct}%</Text>}
          </TouchableOpacity>
        );
      })}
      <Text style={s.pollMeta}>{total} vote{total !== 1 ? 's' : ''}{hasVoted ? ' · Tap to change' : ''}</Text>
    </View>
  );
};

/* Animated poll progress bar */
const AnimatedBar = React.memo(({ pct, isMine }) => {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 400, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <Animated.View style={[
      s.pollBar,
      isMine && s.pollBarMine,
      { width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
    ]} />
  );
});

const s = StyleSheet.create({
  card: { backgroundColor: COLORS.CARD, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER, paddingBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.TEXT, flexShrink: 1 },
  time: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  pollBadge: { backgroundColor: '#F59E0B15', padding: 6, borderRadius: 8 },

  body: { paddingHorizontal: 14, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.TEXT, marginBottom: 4, lineHeight: 22 },
  bodyText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 21 },
  imgWrap: { marginTop: 4 },
  img: { width: '100%', height: SW * 0.75, backgroundColor: COLORS.SURFACE },

  actionBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
  },
  actionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },

  pollWrap: { paddingHorizontal: 14, paddingBottom: 2 },
  pollQ: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT, marginBottom: 10, lineHeight: 22 },
  pollOpt: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.BORDER, backgroundColor: COLORS.SURFACE,
  },
  pollOptMine: { borderColor: COLORS.ACCENT + '50', backgroundColor: COLORS.ACCENT + '06' },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  pollBarMine: { backgroundColor: COLORS.ACCENT + '15' },
  pollOptInner: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, zIndex: 1 },
  pollOptText: { fontSize: 14, fontWeight: '500', color: COLORS.TEXT, flex: 1 },
  pollOptTextMine: { color: COLORS.ACCENT, fontWeight: '700' },
  pollPct: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_MUTED, zIndex: 1 },
  pollMeta: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 6 },
});

export default React.memo(PostCard);
