import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { communityAPI } from '../services/api';

export const COMMUNITY_KEYS = {
  all: ['community'],
  posts: (sort) => ['community', 'posts', sort],
  comments: (postId) => ['community', 'comments', postId],
  polls: ['community', 'polls'],
};

// Stale times per sort — top/hot change slowly, new needs freshness
const SORT_STALE_TIMES = { hot: 30_000, new: 10_000, top: 60_000 };

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
    staleTime: SORT_STALE_TIMES[sort] || 10_000,
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

