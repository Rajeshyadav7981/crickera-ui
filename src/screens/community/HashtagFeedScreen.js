import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl,
  InteractionManager, Modal, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { communityAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../theme';
import BackButton from '../../components/BackButton';
import Avatar from '../../components/Avatar';
import PostCard from '../../components/PostCard';
import MentionInput from '../../components/MentionInput';
import RichText from '../../components/RichText';
import Skeleton from '../../components/Skeleton';

const PAGE_SIZE = 20;

const HashtagFeedScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { hashtag } = route.params;
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  // Comments state
  const [commentModal, setCommentModal] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const flattenComments = (tree) => {
    const result = [];
    (tree || []).forEach(c => {
      result.push({ ...c, _isReply: false });
      const collectReplies = (replies) => {
        (replies || []).forEach(r => {
          result.push({ ...r, _isReply: true, _parentId: c.id });
          collectReplies(r.replies);
        });
      };
      collectReplies(c.replies);
    });
    return result;
  };

  const loadPosts = useCallback(async (offset = 0, append = false) => {
    try {
      const res = await communityAPI.hashtagPosts(hashtag, PAGE_SIZE, offset);
      const data = res.data?.posts || [];
      if (append) {
        setPosts(prev => [...prev, ...data]);
      } else {
        setPosts(data);
      }
      hasMoreRef.current = data.length >= PAGE_SIZE;
      offsetRef.current = offset + data.length;
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [hashtag]);

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => loadPosts(0));
    return () => task.cancel();
  }, [hashtag]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadPosts(0); }, [loadPosts]);

  const loadMore = () => {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    loadPosts(offsetRef.current, true);
  };

  const handleLike = useCallback(async (postId) => {
    if (!postId) return;
    try { await communityAPI.toggleLike(postId); } catch {}
  }, []);

  const openComments = useCallback(async (postId) => {
    if (!postId) return;
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
    const text = newComment.trim();
    const optimistic = {
      id: `temp-${Date.now()}`, text, _isReply: false,
      user: { id: user?.id, full_name: user?.full_name, profile: user?.profile },
      created_at: new Date().toISOString(), likes_count: 0,
    };
    setComments(prev => [...prev, optimistic]);
    setNewComment('');
    try {
      await communityAPI.addComment(commentModal, text);
      refreshComments();
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
    }
  };

  const handleReplySubmit = async (parentId) => {
    if (!replyText.trim() || !commentModal) return;
    const text = replyText.trim();
    const parentComment = comments.find(c => c.id === parentId);
    const rootParent = parentComment?._isReply ? parentComment._parentId : parentId;
    const optimistic = {
      id: `temp-reply-${Date.now()}`, text, _isReply: true, _parentId: rootParent,
      user: { id: user?.id, full_name: user?.full_name, profile: user?.profile },
      created_at: new Date().toISOString(), likes_count: 0,
    };
    setComments(prev => {
      const idx = prev.findLastIndex(c => c.id === rootParent || c._parentId === rootParent);
      const copy = [...prev];
      copy.splice(idx + 1, 0, optimistic);
      return copy;
    });
    setReplyText('');
    setReplyingTo(null);
    try {
      await communityAPI.addComment(commentModal, text, parentId);
      refreshComments();
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
    }
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  const postCount = posts.length;

  const renderPost = useCallback(({ item }) => (
    <PostCard
      post={item}
      type="post"
      currentUserId={user?.id}
      onLike={handleLike}
      onComment={openComments}
      onShare={() => {}}
      onUserPress={(u) => u?.username && navigation.navigate('UserPublicProfile', { username: u.username })}
      onMentionPress={(uname) => navigation.navigate('UserPublicProfile', { username: uname })}
      onHashtagPress={(tag) => { if (tag !== hashtag) navigation.push('HashtagFeed', { hashtag: tag }); }}
    />
  ), [user?.id, handleLike, openComments, hashtag, navigation]);

  // Skeleton
  const FeedSkeleton = () => (
    <View style={{ paddingTop: 12 }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.BORDER }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Skeleton width={38} height={38} borderRadius={19} />
            <View style={{ flex: 1 }}><Skeleton width={120} height={14} /><Skeleton width={60} height={10} style={{ marginTop: 4 }} /></View>
          </View>
          <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="70%" height={14} style={{ marginBottom: 10 }} />
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
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={s.headerCenter}>
          <Text style={s.headerHash}>#</Text>
          <Text style={s.headerTitle}>{hashtag}</Text>
          {!loading && <Text style={s.headerCount}>{postCount} post{postCount !== 1 ? 's' : ''}</Text>}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Feed */}
      {loading ? <FeedSkeleton /> : (
        <FlashList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPost}
          estimatedItemSize={300}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.ACCENT} />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} color={COLORS.ACCENT} /> : null}
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialCommunityIcons name="pound" size={48} color={COLORS.TEXT_MUTED} />
              <Text style={s.emptyTitle}>No posts yet</Text>
              <Text style={s.emptyText}>Be the first to post with #{hashtag}</Text>
            </View>
          }
        />
      )}

      {/* Comments Modal */}
      <Modal visible={commentModal !== null} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalOverlay}>
          <View style={[s.commentsModal, { paddingBottom: insets.bottom + 10 }]}>
            <View style={s.modalHandle} />
            <View style={s.commentsHeader}>
              <Text style={s.commentsTitle}>Comments</Text>
              <TouchableOpacity onPress={() => { setCommentModal(null); setComments([]); setNewComment(''); setReplyingTo(null); }}>
                <MaterialCommunityIcons name="close" size={22} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="small" color={COLORS.ACCENT} style={{ marginTop: 30 }} />
            ) : comments.length === 0 ? (
              <View style={s.noComments}>
                <MaterialCommunityIcons name="comment-text-outline" size={36} color={COLORS.TEXT_MUTED} />
                <Text style={s.noCommentsText}>No comments yet</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {comments.map(c => {
                  const cName = c.user?.full_name || 'User';
                  const isReply = c._isReply;
                  return (
                    <View key={c.id} style={[s.commentRow, isReply && s.replyRow]}>
                      <Avatar uri={c.user?.profile} name={cName} size={isReply ? 24 : 32} color={COLORS.ACCENT} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.cName}>{cName}  <Text style={s.cTime}>{timeAgo(c.created_at)}</Text></Text>
                        <RichText
                          text={c.text}
                          style={s.cText}
                          onMentionPress={(uname) => navigation.navigate('UserPublicProfile', { username: uname })}
                          onHashtagPress={(tag) => { if (tag !== hashtag) navigation.push('HashtagFeed', { hashtag: tag }); }}
                        />
                        <TouchableOpacity onPress={() => { setReplyingTo(replyingTo === c.id ? null : c.id); setReplyText(''); }}>
                          <Text style={s.cReply}>Reply</Text>
                        </TouchableOpacity>
                        {replyingTo === c.id && (
                          <View style={s.replyInputRow}>
                            <TextInput
                              style={s.replyInput}
                              placeholder={`Reply to ${cName}...`}
                              placeholderTextColor={COLORS.TEXT_MUTED}
                              value={replyText}
                              onChangeText={setReplyText}
                              autoFocus
                              multiline
                            />
                            <TouchableOpacity
                              style={[s.replySend, !replyText.trim() && { opacity: 0.3 }]}
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

            {/* Comment Input */}
            <View style={s.commentInputRow}>
              <Avatar uri={user?.profile} name={user?.full_name} size={32} color={COLORS.ACCENT} />
              <MentionInput value={newComment} onChangeText={setNewComment} placeholder="Add a comment..." style={s.commentInput} />
              <TouchableOpacity style={[s.sendBtn, !newComment.trim() && { opacity: 0.4 }]} onPress={handleComment} disabled={!newComment.trim()}>
                <Feather name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.CARD, borderBottomWidth: 1, borderBottomColor: COLORS.BORDER,
  },
  headerCenter: { alignItems: 'center' },
  headerHash: { fontSize: 22, fontWeight: '900', color: COLORS.ACCENT },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.TEXT },
  headerCount: { fontSize: 12, color: COLORS.TEXT_MUTED, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT },
  emptyText: { fontSize: 13, color: COLORS.TEXT_MUTED },

  // Comments Modal
  modalOverlay: { flex: 1, backgroundColor: COLORS.OVERLAY, justifyContent: 'flex-end' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.SURFACE, alignSelf: 'center', marginBottom: 12 },
  commentsModal: { backgroundColor: COLORS.CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%', flex: 1 },
  commentsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  commentsTitle: { fontSize: 18, fontWeight: '800', color: COLORS.TEXT },
  noComments: { alignItems: 'center', paddingVertical: 40, gap: 6 },
  noCommentsText: { fontSize: 15, fontWeight: '600', color: COLORS.TEXT },

  commentRow: { flexDirection: 'row', paddingVertical: 8, gap: 10 },
  replyRow: { paddingLeft: 42 },
  cName: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT },
  cTime: { fontSize: 11, fontWeight: '400', color: COLORS.TEXT_MUTED },
  cText: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 19, marginTop: 2 },
  cReply: { fontSize: 12, color: COLORS.TEXT_MUTED, fontWeight: '600', marginTop: 4 },
  replyInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  replyInput: { flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, color: COLORS.TEXT, maxHeight: 60 },
  replySend: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.ACCENT, alignItems: 'center', justifyContent: 'center' },

  commentInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: 12, gap: 8 },
  commentInput: { flex: 1, backgroundColor: COLORS.SURFACE, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: COLORS.TEXT, maxHeight: 80 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.ACCENT, alignItems: 'center', justifyContent: 'center' },
});

export default HashtagFeedScreen;
