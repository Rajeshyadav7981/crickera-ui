import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { communityAPI } from '../services/api';

export const COMMUNITY_KEYS = {
  all: ['community'],
  posts: (sort) => ['community', 'posts', sort],
  comments: (postId) => ['community', 'comments', postId],
  polls: ['community', 'polls'],
};

export const usePosts = (sort = 'hot', limit = 10) => {
  return useInfiniteQuery({
    queryKey: COMMUNITY_KEYS.posts(sort),
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam?.cursor || null;
      const offset = pageParam?.offset || 0;
      const res = await communityAPI.listPosts(limit, offset, sort, cursor);
      const data = res.data || {};
      return {
        posts: data.posts || (Array.isArray(data) ? data : []),
        next_cursor: data.next_cursor || null,
      };
    },
    getNextPageParam: (lastPage) => {
      const posts = lastPage.posts || [];
      if (posts.length < limit) return undefined;
      if (lastPage.next_cursor) return { cursor: lastPage.next_cursor, offset: 0 };
      return undefined;
    },
    initialPageParam: { cursor: null, offset: 0 },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });
};

export const usePolls = (limit = 5) => {
  return useQuery({
    queryKey: COMMUNITY_KEYS.polls,
    queryFn: async () => {
      const res = await communityAPI.listPolls(limit, 0);
      return res.data || [];
    },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
  });
};

export const useComments = (postId, options = {}) => {
  return useQuery({
    queryKey: COMMUNITY_KEYS.comments(postId),
    queryFn: async () => {
      const res = await communityAPI.getComments(postId, 200, 0, 10);
      return res.data || [];
    },
    enabled: !!postId,
    staleTime: 10_000,
    ...options,
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ text, title, tag, image_url }) =>
      communityAPI.createPost(text, title, tag, image_url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.all });
    },
  });
};

export const useToggleLike = () => {
  return useMutation({
    mutationFn: (postId) => communityAPI.toggleLike(postId),
    // No invalidation — frontend handles optimistic update in PostCard state
  });
};

export const useVotePoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, optionId }) => communityAPI.votePoll(pollId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_KEYS.polls });
    },
  });
};
