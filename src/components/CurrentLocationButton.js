import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

/**
 * "Use Current Location" button.
 * On press: requests permission → gets GPS → reverse geocodes → calls onLocation.
 *
 * @param {Function} onLocation - Called with { latitude, longitude, city, state, country, displayName }
 * @param {object}   style      - Optional extra style
 */
const CurrentLocationButton = ({ onLocation, style }) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
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
    } catch {}
    setLoading(false);
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ACCENT,
  },
});

export default CurrentLocationButton;
