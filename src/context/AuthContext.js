import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, clearTokenCache, setTokenCache } from '../services/api';
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

  // Register push notifications when user is logged in
  useEffect(() => {
    if (user && token) {
      registerForPushNotifications().then((pt) => {
        if (pt) pushTokenRef.current = pt;
      });
    }
  }, [user?.id]);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        setTokenCache(storedToken);
        setToken(storedToken);
        const res = await authAPI.getMe();
        setUser(res.data);
      }
    } catch {
      await AsyncStorage.multiRemove(['token', 'refreshToken']);
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = async (data) => {
    const { access_token, refresh_token, user: userData } = data;
    await AsyncStorage.setItem('token', access_token);
    if (refresh_token) {
      await AsyncStorage.setItem('refreshToken', refresh_token);
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

  const updateUser = async (data) => {
    const res = await authAPI.updateProfile(data);
    setUser(res.data);
    return res.data;
  };

  const refreshUser = async () => {
    const res = await authAPI.getMe();
    setUser(res.data);
  };

  const logout = async () => {
    // Unregister push token before clearing auth
    if (pushTokenRef.current) {
      await unregisterPushToken(pushTokenRef.current);
      pushTokenRef.current = null;
    }
    await AsyncStorage.multiRemove(['token', 'refreshToken']);
    clearTokenCache();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, register, login, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
