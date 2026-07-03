import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../theme';

/**
 * "Use Current Location" button.
 * On press: requests permission → gets GPS → reverse geocodes → calls onLocation.
 *
 * @param {Function} onLocation - Called with { latitude, longitude, city, state, country, displayName }
 * @param {Function} onError    - Optional. Called with a message string on failure; defaults to an Alert.
 * @param {object}   style      - Optional extra style
 */
const CurrentLocationButton = ({ onLocation, onError, style }) => {
  const [loading, setLoading] = useState(false);

  const notify = (msg) => {
    if (onError) onError(msg);
    else Alert.alert('Location', msg);
  };

  const handlePress = async () => {
    setLoading(true);
    try {
      // Bail early if the device has location services turned off entirely.
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        notify('Location services are off. Turn them on in your device settings and try again.');
        return;
      }

      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        notify(canAskAgain
          ? 'Location permission is needed to use your current location.'
          : 'Location permission is blocked. Enable it for CRIXONE in your device settings.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;

      // Reverse geocode to get city/state/country
      let city = '', state = '', country = '', displayName = '';
      try {
        const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geo) {
          city = geo.city || geo.subregion || '';
          state = geo.region || '';
          country = geo.country || '';
          displayName = [city, state, country].filter(Boolean).join(', ');
        }
      } catch {}

      if (!displayName) displayName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

      onLocation({ latitude, longitude, city, state, country, displayName });
    } catch (e) {
      notify('Could not get your location. Make sure GPS is on and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={[styles.btn, style]} onPress={handlePress} disabled={loading} activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.ACCENT} />
      ) : (
        <MaterialCommunityIcons name="crosshairs-gps" size={16} color={COLORS.ACCENT} />
      )}
      <Text style={styles.text}>{loading ? 'Getting location...' : 'Use Current Location'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.ACCENT_SOFT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_SOFT_BORDER,
    marginTop: 8,
  },
  text: {
    fontFamily: FONTS.family,    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ACCENT,
  },
});

export default CurrentLocationButton;
