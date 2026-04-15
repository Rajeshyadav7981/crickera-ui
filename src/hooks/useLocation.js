import { useState, useEffect, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCATION_KEY = 'user_location';

export const useLocation = (autoRequest = true) => {
  const [location, setLocation] = useState(null); // { latitude, longitude }
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Load cached location on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LOCATION_KEY);
        if (cached) setLocation(JSON.parse(cached));
      } catch {}
    })();
  }, []);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        Alert.alert(
          'Location Required',
          'Enable location to discover nearby matches and tournaments.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') Linking.openURL('app-settings:');
              else Linking.openSettings();
            }},
          ],
        );
        return null;
      }
      setPermissionDenied(false);
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setLocation(coords);
      await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(coords));
      setLoading(false);
      return coords;
    } catch {
      setLoading(false);
      return null;
    }
  }, []);

  // Auto-request on mount
  useEffect(() => {
    if (autoRequest && !location) {
      requestLocation();
    }
  }, [autoRequest]);

  return { location, loading, permissionDenied, requestLocation };
};
