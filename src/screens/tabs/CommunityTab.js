import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform,
  ScrollView, Image,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useToast } from '../../components/Toast';
import { communityAPI } from '../../services/api';
import { usePosts, usePolls, COMMUNITY_KEYS } from '../../hooks/useCommunity';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS } from '../../theme';
import Avatar from '../../components/Avatar';
import PostCard from '../../components/PostCard';
import HashtagBar from '../../components/HashtagBar';
import MentionInput from '../../components/MentionInput';
import RichText from '../../components/RichText';
import Skeleton, { PostCardSkeleton, ListSkeleton } from '../../components/Skeleton';
import BottomSheet from '../../components/BottomSheet';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';

// ── Tag Configuration ──
const TAGS = [
  { key: 'Discussion', color: COLORS.ACCENT },
  { key: 'Match Update', color: COLORS.SUCCESS },
  { key: 'Question', color: COLORS.WARNING },
  { key: 'Meme', color: COLORS.PURPLE },
  { key: 'News', color: COLORS.LIVE },
];

const DEPTH_COLORS = [COLORS.ACCENT, COLORS.SUCCESS, COLORS.WARNING, COLORS.PURPLE, '#00BCD4'];

const SORT_OPTIONS = [
  { key: 'hot', label: 'Hot', icon: 'fire' },
  { key: 'new', label: 'New', icon: 'clock-outline' },
  { key: 'top', label: 'Top', icon: 'arrow-up-bold' },
  { key: 'mine', label: 'Mine', icon: 'account-outline' },
];

// ── Main Component ──
const CommunityTab = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState('hot');

  // React Query — posts + polls (cached, deduped, stale-while-revalidate)
  const {
    data: postsPages, isLoading: postsLoading, refetch: refetchPosts,
    isFetching: postsFetching, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = usePosts(sortBy === 'mine' ? 'new' : sortBy);
  const { data: pollsData, refetch: refetchPolls } = usePolls();

  const posts = useMemo(() => postsPages?.pages?.flatMap(p => p.posts) || [], [postsPages]);
  const polls = pollsData || [];
  const loading = postsLoading;
  const refreshing = postsFetching && !postsLoading && !isFetchingNextPage;

  // Create/Edit post
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState('post'); // 'post' | 'poll'
  const [composeText, setComposeText] = useState('');
  const [composeTitle, setComposeTitle] = useState('');
  const [composeTag, setComposeTag] = useState(null);
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [editingPost, setEditingPost] = useState(null);
  const [posting, setPosting] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Comments
  const [commentModal, setCommentModal] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [actionSheet, setActionSheet] = useState(null); // { actions: [] } or null
  const [confirmSheet, setConfirmSheet] = useState(null); // { title, message, onConfirm, destructive } or null

  const feedListRef = useRef(null);

  const switchTab = useCallback((key) => {
    if (key === sortBy) return;
    if (key === 'mine' && !requireAuth('view your posts')) return;
    setSortBy(key);
    feedListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [sortBy, requireAuth]);

  const onCommunityRefresh = useCallback(() => {
    refetchPosts();
    refetchPolls();
  }, [refetchPosts, refetchPolls]);


  // ── Post Actions ──
  const resetCompose = () => {
    setComposeText('');
    setComposeTitle('');
    setComposeTag(null);
    setComposeImageUrl('');
    setComposeType('post');
    setPollQuestion('');
    setPollOptions(['', '']);
    setEditingPost(null);
    setShowCompose(false);
  };

  const handlePost = async () => {
    if (!composeText.trim() || posting) return;
    setPosting(true);
    try {
      const title = composeTitle.trim() || undefined;
      const tag = composeTag || undefined;
      const image_url = composeImageUrl.trim() || undefined;
      const text = composeText.trim();

      if (editingPost) {
        await communityAPI.updatePost(editingPost.id, { text, title, tag, image_url });
      } else {
        await communityAPI.createPost(text, title, tag, image_url);
      }
      resetCompose();
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
    } catch {
      toast.error('Failed to save post');
    } finally {
      setPosting(false);
    }
  };

  const handleCreatePoll = async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!q || opts.length < 2 || posting) return;
    setPosting(true);
    try {
      await communityAPI.createPoll(q, opts);
      resetCompose();
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
    } catch {
      toast.error('Failed to create poll');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = useCallback(async (postId) => {
    if (!postId) return;
    if (!requireAuth('like a post')) return;
    // PostCard handles optimistic UI internally — just fire the API
    // Fire-and-forget — PostCard handles optimistic UI
    communityAPI.toggleLike(postId)
      .then(() => queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all }))
      .catch(() => {});
  }, [queryClient, requireAuth]);

  const showPostOptions = (post) => {
    if (post.user?.id !== user?.id) return;
    setActionSheet({
      actions: [
        {
          label: 'Edit Post', icon: 'pencil-outline',
          onPress: () => {
            setEditingPost(post);
            setComposeText(post.text || '');
            setComposeTitle(post.title || '');
            setComposeTag(post.tag || null);
            setComposeImageUrl(post.image_url || '');
            setShowCompose(true);
          },
        },
        {
          label: 'Delete Post', icon: 'delete-outline', destructive: true,
          onPress: () => {
            setConfirmSheet({
              title: 'Delete Post?',
              message: 'This post will be permanently removed and cannot be recovered.',
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: async () => {
                try {
                  await communityAPI.deletePost(post.id);
                  queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
                } catch {}
              },
            });
          },
        },
      ],
    });
  };

  // ── Comments (Instagram-style: flat parent comments + replies under each) ──

  // Flatten backend tree into: [parent, ...replies] for each top-level comment
  const flattenComments = (tree) => {
    const result = [];
    (tree || []).forEach(c => {
      result.push({ ...c, _isReply: false });
      // Flatten all nested replies into one level under parent
      const collectReplies = (replies) => {
        (replies || []).forEach(r => {
          result.push({ ...r, _isReply: true, _parentId: c.id, _replyToName: r.parent_id === c.id ? null : (tree.find(x => x.id === r.parent_id)?.user?.full_name || null) });
          collectReplies(r.replies);
        });
      };
      collectReplies(c.replies);
    });
    return result;
  };

  const openComments = useCallback(async (postId) => {
    if (!postId) return;
    // Viewing comments is allowed for guests; posting is gated inside handleComment.
    setCommentModal(postId);
    setLoadingComments(true);
    setReplyingTo(null);
    setReplyText('');
    try {
      const res = await communityAPI.getComments(postId, 200, 0, 10);
      setComments(flattenComments(res.data));
    } catch {} finally { setLoadingComments(false); }
  }, []);

  const refreshComments = async () => {
    if (!commentModal) return;
    try {
      const res = await communityAPI.getComments(commentModal, 200, 0, 10);
      setComments(flattenComments(res.data));
    } catch {}
  };

  const handleComment = async () => {
    if (!newComment.trim() || !commentModal) return;
    if (!requireAuth('comment on a post')) return;
    const text = newComment.trim();
    const optimistic = {
      id: `temp-${Date.now()}`, text, _isReply: false,
      user: { id: user?.id, first_name: user?.first_name, last_name: user?.last_name, full_name: user?.full_name, profile: user?.profile },
      created_at: new Date().toISOString(), likes_count: 0,
    };
    setComments(prev => [...prev, optimistic]);
    setNewComment('');
    try {
      await communityAPI.addComment(commentModal, text);
      refreshComments();
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
    }
  };

  const handleReplySubmit = async (parentId) => {
    if (!replyText.trim() || !commentModal) return;
    if (!requireAuth('reply to a comment')) return;
    const text = replyText.trim();
    const parentComment = comments.find(c => c.id === parentId);
    const rootParent = parentComment?._isReply ? parentComment._parentId : parentId;
    const optimistic = {
      id: `temp-reply-${Date.now()}`, text, _isReply: true, _parentId: rootParent,
      user: { id: user?.id, first_name: user?.first_name, last_name: user?.last_name, full_name: user?.full_name, profile: user?.profile },
      created_at: new Date().toISOString(), likes_count: 0,
    };
    // Insert after last reply of the root parent
    setComments(prev => {
      const idx = prev.findLastIndex(c => c.id === rootParent || c._parentId === rootParent);
      const copy = [...prev];
      copy.splice(idx + 1, 0, optimistic);
      return copy;
    });
    // comment count will update on next refetch
    setReplyText('');
    setReplyingTo(null);
    try {
      await communityAPI.addComment(commentModal, text, parentId);
      refreshComments();
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
    }
  };


  const showCommentOptions = (comment) => {
    setActionSheet({
      actions: [
        {
          label: 'Edit Comment', icon: 'pencil-outline',
          onPress: () => {
            setEditingComment(comment);
            setEditCommentText(comment.text);
          },
        },
        {
          label: 'Delete Comment', icon: 'delete-outline', destructive: true,
          onPress: () => {
            setConfirmSheet({
              title: 'Delete Comment?',
              message: 'This comment will be permanently deleted.',
              confirmLabel: 'Delete',
              destructive: true,
              onConfirm: async () => {
                setComments(prev => prev.filter(c => c.id !== comment.id));
                try {
                  await communityAPI.deleteComment(commentModal, comment.id);
                } catch {}
                refreshComments();
                queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
              },
            });
          },
        },
      ],
    });
  };

  const handleEditComment = async () => {
    if (!editingComment || !editCommentText.trim()) return;
    const updatedText = editCommentText.trim();
    setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, text: updatedText } : c));
    setEditingComment(null);
    setEditCommentText('');
    try {
      await communityAPI.editComment(commentModal, editingComment.id, updatedText);
    } catch {}
    refreshComments();
  };

  const handleVote = useCallback(async (pollId, optionId) => {
    if (!requireAuth('vote in a poll')) return;
    // Optimistic: update polls in React Query cache
    queryClient.setQueryData(COMMUNITY_KEYS.polls, (old) => {
      if (!old) return old;
      return old.map(poll => {
        if (poll.id !== pollId) return poll;
        const wasVoted = poll.voted_option_id;
        const isSameOption = wasVoted === optionId;
        return {
          ...poll,
          voted_option_id: isSameOption ? null : optionId,
          total_votes: isSameOption
            ? Math.max(0, (poll.total_votes || 0) - 1)
            : wasVoted ? poll.total_votes : (poll.total_votes || 0) + 1,
          options: poll.options.map(o => {
            let votes = o.votes || 0;
            if (wasVoted && o.id === wasVoted) votes = Math.max(0, votes - 1);
            if (!isSameOption && o.id === optionId) votes += 1;
            return { ...o, votes };
          }),
        };
      });
    });
    // Fire-and-forget — cache already updated optimistically
    communityAPI.votePoll(pollId, optionId)
      .then(() => queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.polls }))
      .catch(() => {});
  }, [queryClient, requireAuth]);

  // ── Helpers ──
  const timeAgo = (d) => {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };


  // ── Memoized feed renderItem ──
  const nav = useNavigation();

  const renderFeedItem = useCallback(({ item }) => (
    <PostCard
      type={item.type}
      post={item.type === 'post' ? item.data : {
        id: null, user: item.data.user, created_at: item.data.created_at,
        likes_count: 0, comments_count: 0,
      }}
      poll={item.type === 'poll' ? item.data : null}
      currentUserId={user?.id}
      onLike={handleLike}
      onComment={openComments}
      onVote={handleVote}
      onShare={() => {}}
      onUserPress={(u) => u?.username && nav.navigate('UserPublicProfile', { username: u.username })}
      onMorePress={item.type === 'post' && item.data.user?.id === user?.id ? () => showPostOptions(item.data) : undefined}
      onMentionPress={(uname) => nav.navigate('UserPublicProfile', { username: uname })}
      onHashtagPress={(tag) => nav.navigate('HashtagFeed', { hashtag: tag })}
    />
  ), [user?.id, handleLike, openComments, handleVote, nav]);

  // ── Build feed data (interleaved by time, filtered by sort) ──
  const feedData = useMemo(() => {
    let filteredPosts = posts;
    let filteredPolls = polls;
    if (sortBy === 'mine') {
      filteredPosts = posts.filter(p => p.user?.id === user?.id);
      filteredPolls = polls.filter(p => p.user?.id === user?.id);
    }
    const all = [
      ...filteredPolls.map(p => ({ type: 'poll', data: p, key: `poll-${p.id}`, time: new Date(p.created_at || 0).getTime() })),
      ...filteredPosts.map(p => ({ type: 'post', data: p, key: `post-${p.id}`, time: new Date(p.created_at || 0).getTime() })),
    ];
    return all.sort((a, b) => b.time - a.time);
  }, [posts, polls, sortBy, user?.id]);

  // Comment tree
  // comments is flat list (parent comments + replies interleaved)

  // Feed skeleton for loading states
  const FeedSkeleton = () => (
    <View style={{ paddingTop: 12 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Skeleton width={38} height={38} borderRadius={19} />
            <View style={{ flex: 1 }}>
              <Skeleton width={120} height={14} />
              <Skeleton width={60} height={10} style={{ marginTop: 4 }} />
            </View>
          </View>
          <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="70%" height={14} style={{ marginBottom: 10 }} />
          {i === 1 && <Skeleton width="100%" height={200} borderRadius={8} style={{ marginBottom: 10 }} />}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
            <Skeleton width={24} height={24} borderRadius={12} />
            <Skeleton width={24} height={24} borderRadius={12} />
            <Skeleton width={24} height={24} borderRadius={12} />
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Community</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => {
            if (!requireAuth('create a post')) return;
            resetCompose();
            setShowCompose(true);
          }}>
            <MaterialCommunityIcons name="plus-circle" size={28} color={COLORS.ACCENT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={s.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBarContent}>
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={s.tab}
                onPress={() => switchTab(opt.key)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name={opt.icon} size={16} color={isActive ? COLORS.ACCENT : COLORS.TEXT_MUTED} />
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{opt.label}</Text>
                {isActive && <View style={s.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Feed ── */}
      {loading ? <FeedSkeleton /> : (
        <FlashList
          ref={feedListRef}
          data={feedData}
          keyExtractor={item => item.key}
          renderItem={renderFeedItem}
          estimatedItemSize={300}
          ListHeaderComponent={
            <HashtagBar onHashtagPress={(tag) => nav.navigate('HashtagFeed', { hashtag: tag })} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={COLORS.ACCENT} />
            </View>
          ) : null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onCommunityRefresh} tintColor={COLORS.ACCENT} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 8 }}>
              <MaterialCommunityIcons name="comment-text-outline" size={48} color={COLORS.TEXT_MUTED} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.TEXT }}>No posts yet</Text>
              <Text style={{ fontSize: 13, color: COLORS.TEXT_MUTED }}>Be the first to share something!</Text>
              <TouchableOpacity
                style={{ marginTop: 12, backgroundColor: COLORS.ACCENT, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
                onPress={() => {
                  if (!requireAuth('create a post')) return;
                  resetCompose();
                  setShowCompose(true);
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Post</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Compose Modal ── */}
      <Modal visible={showCompose} animationType="slide" transparent={false}>
        <View style={[s.composeScreen, { paddingTop: insets.top }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            {/* Header */}
            <View style={s.composeHeader}>
              <TouchableOpacity onPress={resetCompose}>
                <Text style={s.composeCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.composeHeaderTitle}>
                {editingPost ? 'Edit Post' : composeType === 'poll' ? 'Create Poll' : 'Create Post'}
              </Text>
              <TouchableOpacity
                style={[s.composePostBtn,
                  composeType === 'post' && !composeText.trim() && { opacity: 0.4 },
                  composeType === 'poll' && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) && { opacity: 0.4 },
                ]}
                onPress={composeType === 'poll' ? handleCreatePoll : handlePost}
                disabled={
                  posting ||
                  (composeType === 'post' && !composeText.trim()) ||
                  (composeType === 'poll' && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2))
                }
              >
                <Text style={s.composePostText}>
                  {posting ? 'Posting...' : editingPost ? 'Save' : composeType === 'poll' ? 'Create' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Post Type Selector */}
            {!editingPost && (
              <View style={s.typeRow}>
                <TouchableOpacity
                  style={[s.typeBtn, composeType === 'post' && s.typeBtnActive]}
                  onPress={() => setComposeType('post')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="text-box-outline" size={18} color={composeType === 'post' ? '#fff' : COLORS.TEXT_MUTED} />
                  <Text style={[s.typeBtnText, composeType === 'post' && s.typeBtnTextActive]}>Post</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, composeType === 'poll' && s.typeBtnActive]}
                  onPress={() => setComposeType('poll')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="poll" size={18} color={composeType === 'poll' ? '#fff' : COLORS.TEXT_MUTED} />
                  <Text style={[s.typeBtnText, composeType === 'poll' && s.typeBtnTextActive]}>Poll</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={s.composeBody} keyboardShouldPersistTaps="handled">
              {composeType === 'post' ? (
                <>
                  {/* User avatar row */}
                  <View style={s.composeUserRow}>
                    <Avatar uri={user?.profile} name={user?.full_name || user?.first_name} size={40} color={COLORS.ACCENT} />
                    <Text style={s.composePrompt}>What's on your mind?</Text>
                  </View>

                  {/* Tag Selector */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tagRow} contentContainerStyle={s.tagRowContent}>
                    {TAGS.map(tag => {
                      const isSelected = composeTag === tag.key;
                      return (
                        <TouchableOpacity
                          key={tag.key}
                          style={[s.tagChip, { borderColor: tag.color + '60' }, isSelected && { backgroundColor: tag.color + '25', borderColor: tag.color }]}
                          onPress={() => setComposeTag(isSelected ? null : tag.key)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.tagChipDot, { backgroundColor: tag.color }]} />
                          <Text style={[s.tagChipText, isSelected && { color: tag.color }]}>{tag.key}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Title */}
                  <TextInput
                    style={s.composeTitleInput}
                    placeholder="Title (optional)"
                    placeholderTextColor={COLORS.TEXT_HINT}
                    value={composeTitle}
                    onChangeText={setComposeTitle}
                    maxLength={150}
                  />

                  {/* Body with @mention support */}
                  <MentionInput
                    value={composeText}
                    onChangeText={setComposeText}
                    placeholder="Write something... Use @ to tag, # for hashtags"
                    style={s.composeTextInput}
                    autoFocus
                  />

                  {/* Character counter */}
                  <Text style={[s.charCounter, composeText.length > 900 && { color: COLORS.DANGER }]}>
                    {composeText.length}/1000
                  </Text>

                  {/* Image URL input */}
                  <View style={s.imageUrlRow}>
                    <MaterialCommunityIcons name="image-outline" size={20} color={COLORS.TEXT_MUTED} />
                    <TextInput
                      style={s.imageUrlInput}
                      placeholder="Paste image URL (optional)"
                      placeholderTextColor={COLORS.TEXT_HINT}
                      value={composeImageUrl}
                      onChangeText={setComposeImageUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                    {composeImageUrl.length > 0 && (
                      <TouchableOpacity onPress={() => setComposeImageUrl('')}>
                        <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.TEXT_MUTED} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Image Preview */}
                  {composeImageUrl.trim() ? (
                    <View style={s.composeImagePreview}>
                      <Image
                        source={{ uri: composeImageUrl.trim() }}
                        style={s.composePreviewImage}
                        resizeMode="cover"
                      />
                      <TouchableOpacity style={s.removeImageBtn} onPress={() => setComposeImageUrl('')}>
                        <MaterialCommunityIcons name="close-circle" size={28} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </>
              ) : (
                /* ── Poll Creator ── */
                <>
                  <View style={s.composeUserRow}>
                    <Avatar uri={user?.profile} name={user?.full_name || user?.first_name} size={40} color={COLORS.ACCENT} />
                    <Text style={s.composePrompt}>Ask the community</Text>
                  </View>

                  <TextInput
                    style={s.pollQuestionInput}
                    placeholder="Ask a question..."
                    placeholderTextColor={COLORS.TEXT_HINT}
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    multiline
                    maxLength={300}
                    autoFocus
                  />

                  {pollOptions.map((opt, i) => (
                    <View key={i} style={s.pollOptionRow}>
                      <View style={[s.pollOptionDot, { backgroundColor: DEPTH_COLORS[i % DEPTH_COLORS.length] }]} />
                      <TextInput
                        style={s.pollOptionInput}
                        placeholder={`Option ${i + 1}`}
                        placeholderTextColor={COLORS.TEXT_HINT}
                        value={opt}
                        onChangeText={(text) => {
                          const updated = [...pollOptions];
                          updated[i] = text;
                          setPollOptions(updated);
                        }}
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <TouchableOpacity onPress={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}>
                          <MaterialCommunityIcons name="close-circle-outline" size={20} color={COLORS.TEXT_MUTED} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {pollOptions.length < 6 && (
                    <TouchableOpacity
                      style={s.addOptionBtn}
                      onPress={() => setPollOptions([...pollOptions, ''])}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="plus-circle-outline" size={20} color={COLORS.ACCENT} />
                      <Text style={s.addOptionText}>Add option</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Comments Modal (Instagram-style) ── */}
      <Modal visible={commentModal !== null} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.commentsModal, { paddingBottom: insets.bottom + 10 }]}>
            <View style={s.modalHandle} />
            <View style={s.commentsHeader}>
              <Text style={s.commentsTitle}>Comments</Text>
              <TouchableOpacity onPress={() => { setCommentModal(null); setComments([]); setNewComment(''); setReplyingTo(null); setReplyText(''); }}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="small" color={COLORS.ACCENT} style={{ marginTop: 30 }} />
            ) : comments.length === 0 ? (
              <View style={s.noComments}>
                <MaterialCommunityIcons name="comment-text-outline" size={36} color={COLORS.TEXT_MUTED} />
                <Text style={s.noCommentsText}>No comments yet</Text>
                <Text style={s.noCommentsSub}>Start the conversation!</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {comments.map(c => {
                  const cName = c.user?.full_name || `${c.user?.first_name || ''} ${c.user?.last_name || ''}`.trim() || 'User';
                  const isReply = c._isReply;
                  return (
                    <View key={c.id} style={[cs.commentRow, isReply && cs.replyRow]}>
                      <Avatar uri={c.user?.profile} name={cName} size={isReply ? 24 : 32} color={COLORS.ACCENT} />
                      <View style={cs.commentBody}>
                        {/* Edit mode */}
                        {editingComment?.id === c.id ? (
                          <View style={cs.editRow}>
                            <TextInput
                              style={cs.editInput}
                              value={editCommentText}
                              onChangeText={setEditCommentText}
                              autoFocus
                              multiline
                            />
                            <View style={cs.editBtns}>
                              <TouchableOpacity onPress={() => { setEditingComment(null); setEditCommentText(''); }}>
                                <Text style={cs.editCancel}>Cancel</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={handleEditComment} disabled={!editCommentText.trim()}>
                                <Text style={[cs.editSave, !editCommentText.trim() && { opacity: 0.4 }]}>Save</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={cs.commentBubble}>
                              <View style={cs.nameRow}>
                                <Text style={cs.commentName} numberOfLines={1}>{cName}</Text>
                                <Text style={cs.commentTime}>{timeAgo(c.created_at)}</Text>
                                {c.user?.id === user?.id && (
                                  <TouchableOpacity onPress={() => showCommentOptions(c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <MaterialCommunityIcons name="dots-horizontal" size={16} color={COLORS.TEXT_MUTED} />
                                  </TouchableOpacity>
                                )}
                              </View>
                              <RichText
                                text={c.text}
                                style={cs.commentText}
                                onMentionPress={(uname) => nav.navigate('UserPublicProfile', { username: uname })}
                                onHashtagPress={(tag) => nav.navigate('HashtagFeed', { hashtag: tag })}
                              />
                            </View>
                            <View style={cs.commentActions}>
                              <TouchableOpacity style={cs.cAction} onPress={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(''); }}>
                                <Text style={cs.cActionText}>Reply</Text>
                              </TouchableOpacity>
                              <Text style={cs.cActionTime}>{timeAgo(c.created_at)}</Text>
                            </View>
                          </>
                        )}

                        {/* Inline reply input */}
                        {replyingTo === c.id && !editingComment && (
                          <View style={cs.replyInputRow}>
                            <Avatar uri={user?.profile} name={user?.full_name || user?.first_name} size={20} color={COLORS.ACCENT} />
                            <TextInput
                              style={cs.replyInput}
                              placeholder={`Reply to ${cName}...`}
                              placeholderTextColor={COLORS.TEXT_MUTED}
                              value={replyText}
                              onChangeText={setReplyText}
                              autoFocus
                              multiline
                            />
                            <TouchableOpacity
                              style={[cs.replySend, !replyText.trim() && { opacity: 0.3 }]}
                              onPress={() => handleReplySubmit(c.id)}
                              disabled={!replyText.trim()}
                            >
                              <Feather name="send" size={12} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Top-level Comment Input */}
            <View style={s.commentInputRow}>
              <Avatar uri={user?.profile} name={user?.full_name || user?.first_name} size={32} color={COLORS.ACCENT} />
              <MentionInput
                value={newComment}
                onChangeText={setNewComment}
                placeholder="Add a comment..."
                style={s.commentInput}
              />
              <TouchableOpacity
                style={[s.sendBtn, !newComment.trim() && { opacity: 0.4 }]}
                onPress={handleComment} disabled={!newComment.trim()}
              >
                <Feather name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Action Sheet ── */}
      <BottomSheet
        visible={!!actionSheet}
        onClose={() => setActionSheet(null)}
        actions={actionSheet?.actions}
      />

      {/* ── Confirm Dialog ── */}
      <BottomSheet
        visible={!!confirmSheet}
        onClose={() => setConfirmSheet(null)}
        confirm={confirmSheet}
      />
    </View>
  );
};

// ── Comment Styles (Instagram-style) ──
const cs = StyleSheet.create({
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 10 },
  replyRow: { paddingLeft: 58 }, // indent replies under parent avatar
  commentBody: { flex: 1 },
  commentBubble: {},
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  commentTime: { fontSize: 11, fontWeight: '400', color: COLORS.TEXT_MUTED },
  editRow: { marginTop: 2 },
  editInput: {
    backgroundColor: COLORS.SURFACE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: COLORS.TEXT, borderWidth: 1, borderColor: COLORS.ACCENT + '40', minHeight: 40,
  },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 6 },
  editCancel: { fontSize: 13, fontWeight: '600', color: COLORS.TEXT_MUTED },
  editSave: { fontSize: 13, fontWeight: '700', color: COLORS.ACCENT },
  commentText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 19, marginTop: 2 },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  cAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 2 },
  cActionText: { fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  cActionTime: { fontSize: 11, color: COLORS.TEXT_HINT },
  replyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  replyInput: {
    flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6,
    fontSize: 13, color: COLORS.TEXT, maxHeight: 60,
  },
  replySend: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.ACCENT, alignItems: 'center', justifyContent: 'center' },
});

// ── Main Styles ──
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.BG },
  center: { flex: 1, backgroundColor: COLORS.BG, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT },
  headerRight: { flexDirection: 'row', gap: 12 },
  headerIconBtn: { padding: 4 },

  // Tab Bar
  tabBar: { backgroundColor: COLORS.CARD, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER },
  tabBarContent: { paddingHorizontal: 8 },
  tab: {
    alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10,
    flexDirection: 'row', gap: 6, position: 'relative',
  },
  tabLabel: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_MUTED },
  tabLabelActive: { color: COLORS.ACCENT, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute', bottom: 0, left: 12, right: 12, height: 3,
    backgroundColor: COLORS.ACCENT, borderTopLeftRadius: 3, borderTopRightRadius: 3,
  },


  // Compose Modal (Full-screen)
  composeScreen: {
    flex: 1,
    backgroundColor: COLORS.BG,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  composeCancel: { fontSize: 15, color: COLORS.TEXT_MUTED, fontWeight: '600' },
  composeHeaderTitle: { fontSize: 17, fontWeight: '800', color: COLORS.TEXT },
  composePostBtn: { backgroundColor: COLORS.ACCENT, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  composePostText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  composeBody: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Tag Selector
  tagRow: {
    marginTop: 16,
    marginBottom: 8,
    maxHeight: 44,
  },
  tagRowContent: {
    gap: 8,
    paddingRight: 16,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  tagChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },

  // Compose Inputs
  composeTitleInput: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.TEXT,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  composeTextInput: {
    fontSize: 16,
    color: COLORS.TEXT,
    minHeight: 150,
    lineHeight: 24,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  imageUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  imageUrlInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.TEXT,
  },
  composeImagePreview: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  composePreviewImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.BG + 'CC',
    borderRadius: 14,
  },

  // Post type selector
  typeRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.SURFACE },
  typeBtnActive: { backgroundColor: COLORS.ACCENT },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.TEXT_MUTED },
  typeBtnTextActive: { color: '#fff' },

  // Compose user row
  composeUserRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, marginBottom: 8 },
  composePrompt: { fontSize: 15, color: COLORS.TEXT_MUTED, fontWeight: '500' },

  // Character counter
  charCounter: { fontSize: 12, color: COLORS.TEXT_MUTED, textAlign: 'right', paddingTop: 4 },

  // Image toolbar

  // Poll creator
  pollQuestionInput: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER, minHeight: 60 },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, backgroundColor: COLORS.SURFACE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  pollOptionDot: { width: 10, height: 10, borderRadius: 5 },
  pollOptionInput: { flex: 1, fontSize: 15, color: COLORS.TEXT, padding: 0 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 10 },
  addOptionText: { fontSize: 14, fontWeight: '600', color: COLORS.ACCENT },

  // Comments Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'flex-end' },
  modalHandle: { width: 40, height: 4, backgroundColor: COLORS.SURFACE, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  commentsModal: { backgroundColor: COLORS.CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', flex: 1 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  commentsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },

  noComments: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  noCommentsText: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },
  noCommentsSub: { fontSize: 12, color: COLORS.TEXT_MUTED },

  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: 12, gap: 8 },
  commentInput: { flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.TEXT, maxHeight: 80 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.ACCENT, alignItems: 'center', justifyContent: 'center' },
});

export default CommunityTab;
