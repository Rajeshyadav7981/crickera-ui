import { useState, useEffect, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_KEY = 'user_location';

export const useLocation = (autoRequest = true) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [denialReason, setDenialReason] = useState(null);

  const openLocationSettings = useCallback(() => {
    if (Platform.OS === 'ios') Linking.openURL('app-settings:');
    else Linking.openSettings();
  }, []);

  const refreshLocation = useCallback(async () => {
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setPermissionDenied(true);
        setDenialReason('services');
        return;
      }
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setDenialReason('permission');
        return;
      }
      setPermissionDenied(false);
      setDenialReason(null);
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(coords);
        await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(coords));
      } catch {}
    } catch {}
  }, []);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setPermissionDenied(true);
        setDenialReason('services');
        setLoading(false);
        return null;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setDenialReason('permission');
        setLoading(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(coords);
      setPermissionDenied(false);
      setDenialReason(null);
      await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(coords));
      setLoading(false);
      return coords;
    } catch {
      setPermissionDenied(true);
      setDenialReason('gps');
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LOCATION_KEY);
        if (cached) setLocation(JSON.parse(cached));
      } catch {}
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'undetermined' && autoRequest) {
          requestLocation();
        } else {
          refreshLocation();
        }
      } catch {}
    })();
  }, [autoRequest, requestLocation, refreshLocation]);

  return {
    location,
    loading,
    permissionDenied,
    denialReason,
    requestLocation,
    refreshLocation,
    openLocationSettings,
  };
};
