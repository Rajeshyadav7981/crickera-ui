import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// API URL configuration
// - In Expo Go dev mode: auto-detects host machine's LAN IP (for physical devices)
//   and uses localhost for web / simulator. Backend must run on port 7981.
// - In production builds: uses the deployed cloud URL.
const PRODUCTION_URL = 'https://creckstars.duckdns.org';
const LOCAL_PORT = 7981;

const getLocalBaseUrl = () => {
  // Web: use localhost directly
  if (Platform.OS === 'web') return `http://localhost:${LOCAL_PORT}`;
  // Android emulator cannot reach host via localhost — use 10.0.2.2
  // Physical devices / iOS simulator: use Expo debugger host LAN IP
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = hostUri ? hostUri.split(':')[0] : null;
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${LOCAL_PORT}`;
  }
  if (Platform.OS === 'android') return `http://10.0.2.2:${LOCAL_PORT}`;
  return `http://localhost:${LOCAL_PORT}`;
};

const API_BASE_URL = __DEV__ ? getLocalBaseUrl() : PRODUCTION_URL;

if (__DEV__) {
  console.log('[API] Using base URL:', API_BASE_URL);
}

// In-memory token cache to avoid repeated AsyncStorage reads
let _cachedToken = null;

export const setTokenCache = (token) => {
  _cachedToken = token;
};

export const clearTokenCache = () => {
  _cachedToken = null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  let token = _cachedToken;
  if (!token) {
    token = await AsyncStorage.getItem('token');
    if (token) _cachedToken = token;
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Token refresh handling ────────────────────────────────────────────────
// Single-flight refresh: when many concurrent requests get 401, only ONE
// refresh call is in-flight at a time. The rest await its result.
let _refreshPromise = null;

const performRefresh = async () => {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) {
    const e = new Error('No refresh token');
    e._noRefresh = true;
    throw e;
  }
  // Use a bare axios instance so we don't recurse through this interceptor.
  const res = await axios.post(`${API_BASE_URL}/api/auth/refresh`, null, {
    headers: { Authorization: `Bearer ${refreshToken}` },
    timeout: 10000,
  });
  const { access_token, refresh_token } = res.data || {};
  if (!access_token) {
    const e = new Error('Refresh response missing access_token');
    e._noRefresh = true;
    throw e;
  }
  await AsyncStorage.setItem('token', access_token);
  if (refresh_token) {
    await AsyncStorage.setItem('refreshToken', refresh_token);
  }
  setTokenCache(access_token);
  return access_token;
};

const getRefreshedToken = () => {
  if (!_refreshPromise) {
    _refreshPromise = performRefresh().finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    // Don't try to refresh if we're already retrying, or if the failed request
    // WAS the refresh call itself (the URL ends with /api/auth/refresh).
    const url = originalRequest.url || '';
    const isRefreshCall = url.includes('/api/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;
      try {
        const access_token = await getRefreshedToken();
        // Defensive: some retried configs come back without a headers object.
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Only wipe tokens if the refresh ITSELF returned an explicit 401/403,
        // OR there was no refresh token to begin with. Network errors,
        // timeouts, 5xx, etc. are transient — leave tokens alone so the next
        // attempt can succeed.
        const refreshStatus = refreshError?.response?.status;
        const explicitAuthFailure = refreshStatus === 401 || refreshStatus === 403;
        const noRefreshAvailable = refreshError?._noRefresh === true;
        if (explicitAuthFailure || noRefreshAvailable) {
          await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
          clearTokenCache();
        }
        // Surface the ORIGINAL 401 so callers see a consistent failure mode.
        return Promise.reject(error);
      }
    }
    // Handle rate limiting (429) — auto-retry after delay
    if (error.response?.status === 429 && !originalRequest._rateLimitRetry) {
      originalRequest._rateLimitRetry = true;
      const retryAfter = parseInt(error.response.headers?.['retry-after'] || error.response.data?.retry_after || '5', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);

export const usersAPI = {
  search: (q, { signal } = {}) => api.get('/api/users/search', { params: { q }, signal }),
  mentionSearch: (q, limit = 10, { signal } = {}) => api.get('/api/users/mention-search', { params: { q, limit }, signal }),
  getProfile: (username, { signal } = {}) => api.get(`/api/users/@${username}`, { signal }),
  myStats: () => api.get('/api/users/me/stats'),
  setUsername: (username) => api.post('/api/users/username', { username }),
  checkUsername: (username) => api.get('/api/users/username/check', { params: { username } }),
  follow: (userId) => api.post(`/api/users/follow/${userId}`),
  unfollow: (userId) => api.delete(`/api/users/follow/${userId}`),
  getFollowers: (userId, limit = 20, offset = 0) => api.get(`/api/users/${userId}/followers`, { params: { limit, offset } }),
  getFollowing: (userId, limit = 20, offset = 0) => api.get(`/api/users/${userId}/following`, { params: { limit, offset } }),
};

export const authAPI = {
  register: (first_name, last_name, mobile, email, password, profile, username, cricketProfile = {}) =>
    api.post('/api/auth/register', {
      first_name, last_name, mobile, email, password, profile, username,
      ...cricketProfile,
    }),
  login: (mobile, password) =>
    api.post('/api/auth/login', { mobile, password }),
  sendOTP: (mobile, purpose = 'register') =>
    api.post('/api/auth/send-otp', { mobile, purpose }),
  verifyOTP: (mobile, otp, purpose = 'register') =>
    api.post('/api/auth/verify-otp', { mobile, otp, purpose }),
  getMe: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/me', data),
  uploadProfilePhoto: async (uri) => {
    // Compress on client before upload
    let compressedUri = uri;
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 512 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      compressedUri = result.uri;
    } catch {}

    // Upload to backend server (not Firebase)
    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: `profile_${Date.now()}.jpg`,
    });
    const res = await api.post('/api/auth/me/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res;
  },
};

export const teamsAPI = {
  create: (data) => api.post('/api/teams', data),
  list: (params) => api.get('/api/teams', { params }),
  get: (id) => api.get(`/api/teams/${id}`),
  addPlayer: (teamId, data) => api.post(`/api/teams/${teamId}/players`, data),
  updatePlayerRole: (teamId, playerId, data) => api.put(`/api/teams/${teamId}/players/${playerId}`, data),
  removePlayer: (teamId, playerId) => api.delete(`/api/teams/${teamId}/players/${playerId}`),
};

export const playersAPI = {
  create: (data) => api.post('/api/players', data),
  update: (id, data) => api.put(`/api/players/${id}`, data),
  list: (search) => api.get('/api/players', { params: { search } }),
  get: (id) => api.get(`/api/players/${id}`),
  stats: (id) => api.get(`/api/players/${id}/stats`),
};

export const venuesAPI = {
  create: (data) => api.post('/api/venues', data),
  list: () => api.get('/api/venues'),
  searchLocation: (q) => api.get('/api/venues/search-location', { params: { q } }),
  nearby: (lat, lng, radius = 50) => api.get('/api/venues/nearby', { params: { lat, lng, radius } }),
};

export const tournamentsAPI = {
  create: (data) => api.post('/api/tournaments', data),
  list: (params) => api.get('/api/tournaments', { params }),
  get: (id) => api.get(`/api/tournaments/${id}`),
  update: (id, data) => api.put(`/api/tournaments/${id}`, data),
  addTeam: (tournamentId, teamId) => api.post(`/api/tournaments/${tournamentId}/teams`, { team_id: teamId }),
  removeTeam: (tournamentId, teamId) => api.delete(`/api/tournaments/${tournamentId}/teams/${teamId}`),
  standings: (tournamentId) => api.get(`/api/tournaments/${tournamentId}/standings`),
  leaderboard: (tournamentId) => api.get(`/api/tournaments/${tournamentId}/leaderboard`),
  setupStages: (tournamentId, stages) => api.post(`/api/tournaments/${tournamentId}/stages`, { stages }),
  getStages: (tournamentId) => api.get(`/api/tournaments/${tournamentId}/stages`),
  setupGroups: (tournamentId, stageId, groups) => api.post(`/api/tournaments/${tournamentId}/stages/${stageId}/groups`, { groups }),
  generateMatches: (tournamentId, stageId) => api.post(`/api/tournaments/${tournamentId}/stages/${stageId}/generate-matches`),
  stageStandings: (tournamentId, stageId) => api.get(`/api/tournaments/${tournamentId}/stages/${stageId}/standings`),
  scheduleMatches: (tournamentId, stageId, schedule) => api.post(`/api/tournaments/${tournamentId}/stages/${stageId}/schedule-matches`, { schedule }),
  updateQualification: (tournamentId, stageId, topN) => api.put(`/api/tournaments/${tournamentId}/stages/${stageId}/qualification`, { top_n: topN }),
  swapBracket: (tournamentId, stageId, matchAId, matchBId, swapType = 'cross') =>
    api.post(`/api/tournaments/${tournamentId}/stages/${stageId}/swap-bracket`, { match_a_id: matchAId, match_b_id: matchBId, swap_type: swapType }),
  overrideMatch: (tournamentId, matchId, data) => api.post(`/api/tournaments/${tournamentId}/matches/${matchId}/override`, data),
  deleteMatch: (tournamentId, matchId) => api.delete(`/api/tournaments/${tournamentId}/matches/${matchId}`),
  resetStage: (tournamentId, stageId) => api.post(`/api/tournaments/${tournamentId}/stages/${stageId}/reset`),
  deleteStage: (tournamentId, stageId) => api.delete(`/api/tournaments/${tournamentId}/stages/${stageId}`),
};

export const matchesAPI = {
  create: (data) => api.post('/api/matches', data),
  list: (params) => api.get('/api/matches', { params }),
  get: (id) => api.get(`/api/matches/${id}`),
  // PATCH editable fields (overs, schedule). Backend rejects once play has started.
  update: (id, data) => api.patch(`/api/matches/${id}`, data),
  nearby: (lat, lng, radius = 50) => api.get('/api/matches/nearby', { params: { lat, lng, radius } }),
  toss: (matchId, data) => api.post(`/api/matches/${matchId}/toss`, data),
  setSquad: (matchId, data) => api.post(`/api/matches/${matchId}/squads`, data),
  getSquad: (matchId, teamId) => api.get(`/api/matches/${matchId}/squads/${teamId}`),
  startInnings: (matchId, data) => api.post(`/api/matches/${matchId}/start-innings`, data),
};

export const scoringAPI = {
  score: (matchId, data) => api.post(`/api/matches/${matchId}/score`, data),
  undo: (matchId) => api.post(`/api/matches/${matchId}/undo`),
  abandon: (matchId, reason) => api.post(`/api/matches/${matchId}/abandon`, { reason }),
  noResult: (matchId, reason) => api.post(`/api/matches/${matchId}/no-result`, { reason }),
  endOver: (matchId, nextBowlerId) => api.post(`/api/matches/${matchId}/end-over`, { next_bowler_id: nextBowlerId }),
  endInnings: (matchId) => api.post(`/api/matches/${matchId}/end-innings`),
  swapBatters: (matchId) => api.post(`/api/matches/${matchId}/swap-batters`),
  endMatch: (matchId) => api.post(`/api/matches/${matchId}/end-match`),
  endMatchAsTie: (matchId) => api.post(`/api/matches/${matchId}/end-match?force_tie=true`),
  revert: (matchId) => api.post(`/api/matches/${matchId}/revert`),
  liveState: (matchId) => api.get(`/api/matches/${matchId}/live-state`),
  scorecard: (matchId) => api.get(`/api/matches/${matchId}/scorecard`),
  commentary: (matchId, inningsNumber, limit, offset) =>
    api.get(`/api/matches/${matchId}/commentary`, { params: { innings_number: inningsNumber, limit, offset } }),
  broadcast: (matchId, message) => api.post(`/api/matches/${matchId}/broadcast`, { message }),
  clearBroadcast: (matchId) => api.delete(`/api/matches/${matchId}/broadcast`),
  getBroadcast: (matchId) => api.get(`/api/matches/${matchId}/broadcast`),
};

export const communityAPI = {
  // Posts
  createPost: (text, title, tag, image_url) => api.post('/api/community/posts', { text, title, tag, image_url }),
  uploadPostImage: async (uri) => {
    let compressedUri = uri;
    try {
      const ImageManipulator = require('expo-image-manipulator');
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      compressedUri = result.uri;
    } catch {}
    const formData = new FormData();
    formData.append('file', {
      uri: compressedUri,
      type: 'image/jpeg',
      name: `post_${Date.now()}.jpg`,
    });
    return api.post('/api/community/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  updatePost: (postId, data) => api.put(`/api/community/posts/${postId}`, data),
  listPosts: (limit = 20, offset = 0, sort = 'hot', cursor = null) =>
    api.get('/api/community/posts', { params: { limit, offset, sort, ...(cursor ? { cursor } : {}) } }),
  deletePost: (postId) => api.delete(`/api/community/posts/${postId}`),
  toggleLike: (postId) => api.post(`/api/community/posts/${postId}/like`),
  addComment: (postId, text, parentId) => api.post(`/api/community/posts/${postId}/comments`, { text, parent_id: parentId }),
  getComments: (postId, limit = 50, offset = 0, maxDepth = 2, parentId = null) =>
    api.get(`/api/community/posts/${postId}/comments`, { params: { limit, offset, max_depth: maxDepth, parent_id: parentId } }),
  likeComment: (postId, commentId) => api.post(`/api/community/posts/${postId}/comments/${commentId}/like`),
  editComment: (postId, commentId, text) => api.put(`/api/community/posts/${postId}/comments/${commentId}`, { text }),
  deleteComment: (postId, commentId) => api.delete(`/api/community/posts/${postId}/comments/${commentId}`),
  // Polls
  createPoll: (question, options) => api.post('/api/community/polls', { question, options }),
  listPolls: (limit = 10, offset = 0) => api.get('/api/community/polls', { params: { limit, offset } }),
  votePoll: (pollId, optionId) => api.post(`/api/community/polls/${pollId}/vote`, { option_id: optionId }),
  // Hashtags & Mentions
  trendingHashtags: () => api.get('/api/community/hashtags/trending'),
  searchHashtags: (q) => api.get('/api/community/hashtags/search', { params: { q } }),
  hashtagPosts: (name, limit = 20, offset = 0) => api.get(`/api/community/hashtags/${name}/posts`, { params: { limit, offset } }),
  getMentions: (limit = 20, offset = 0) => api.get('/api/community/mentions', { params: { limit, offset } }),
};

export const notificationsAPI = {
  registerToken: (token, device_type) => api.post('/api/notifications/push-token', { token, device_type }),
  removeToken: (token) => api.delete('/api/notifications/push-token', { data: { token } }),
  subscribe: (matchId) => api.post(`/api/notifications/subscribe/${matchId}`),
  unsubscribe: (matchId) => api.delete(`/api/notifications/subscribe/${matchId}`),
  getSubscriptions: () => api.get('/api/notifications/subscriptions'),
};

export const appAPI = {
  checkVersion: (currentVersion) =>
    api.get('/api/app/version', { params: { current: currentVersion } }),
};

export const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export default api;
