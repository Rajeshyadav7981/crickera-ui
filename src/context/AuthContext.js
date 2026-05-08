import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI, clearTokenCache, setTokenCache } from '../services/api';
import {
  getSecureItem,
  setSecureItem,
  removeAuthItems,
  migrateLegacyTokens,
} from '../services/tokenStorage';
import { registerForPushNotifications, unregisterPushToken } from '../services/notifications';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const pushTokenRef = useRef(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Register push notifications when user is logged in.
  // Guards against: (a) duplicate registrations if the effect re-runs while a
  // previous call is in flight, and (b) a late-returning promise from a prior
  // user setting the token ref after we've already logged out.
  useEffect(() => {
    if (!user || !token) return undefined;
    let cancelled = false;
    const thisUserId = user.id;
    registerForPushNotifications()
      .then((pt) => {
        if (cancelled) return;
        if (pt) pushTokenRef.current = pt;
      })
      .catch((err) => {
        if (__DEV__) console.warn('[Auth] push register failed', err?.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadStoredAuth = async () => {
    try {
      // First launch after the SecureStore rollout: move any plaintext tokens
      // out of AsyncStorage so the app picks up where the user left off.
      await migrateLegacyTokens();
      const storedToken = await getSecureItem('token');
      if (storedToken) {
        setTokenCache(storedToken);
        setToken(storedToken);
        const res = await authAPI.getMe();
        setUser(res.data);
      }
    } catch {
      await removeAuthItems(['token', 'refreshToken']);
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = async (data) => {
    const { access_token, refresh_token, user: userData } = data;
    await setSecureItem('token', access_token);
    if (refresh_token) {
      await setSecureItem('refreshToken', refresh_token);
    }
    setTokenCache(access_token);
    setToken(access_token);
    setUser(userData);
  };

  const register = async (first_name, last_name, mobile, email, password, username, cricketProfile = {}) => {
    const res = await authAPI.register(first_name, last_name, mobile, email, password, null, username, cricketProfile);
    await saveAuth(res.data);
  };

  const login = async (mobile, password) => {
    const res = await authAPI.login(mobile, password);
    await saveAuth(res.data);
  };

  const refreshUser = async () => {
    const res = await authAPI.getMe();
    setUser(res.data);
    return res.data;
  };

  // Optimistic, synchronous patch of the AuthContext user. Use this when a
  // screen already knows a field should change (e.g. follower count after a
  // follow/unfollow) and wants the UI to update without waiting for the
  // server round-trip. Pair with refreshUser() to reconcile.
  const patchUser = (partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  const updateUser = async (data) => {
    // PUT returns the updated user, but we re-hit /me right after so the
    // context is guaranteed to include fields the PUT response may omit
    // (followers_count, created_at, etc.). This is what makes Profile /
    // Home avatar / follower numbers refresh immediately after an edit.
    const res = await authAPI.updateProfile(data);
    setUser(res.data);
    try {
      await refreshUser();
    } catch {}
    return res.data;
  };

  const logout = async () => {
    // Unregister push token before clearing auth. Failure here shouldn't block
    // logout — if the network is down, we still want the user signed out locally;
    // the token will be cleaned up by the backend's inactivity sweep.
    const tokenToUnregister = pushTokenRef.current;
    pushTokenRef.current = null;
    if (tokenToUnregister) {
      try {
        await unregisterPushToken(tokenToUnregister);
      } catch (err) {
        if (__DEV__) console.warn('[Auth] push unregister failed', err?.message);
      }
    }
    await removeAuthItems(['token', 'refreshToken']);
    clearTokenCache();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout, updateUser, refreshUser, patchUser }}>
      {children}
    </AuthContext.Provider>
  );
};
