import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';

/**
 * Universal Avatar component with cricket-themed fallbacks:
 *   1. Profile image (if URL provided and loads)
 *   2. Initials on colored gradient background
 *   3. Cricket-themed default icon (bat for players, shield for teams)
 */
const Avatar = ({
  uri,
  name,
  size = 44,
  color = COLORS.ACCENT,
  showRing = false,
  style,
  type = 'user', // 'user' | 'team' | 'player'
}) => {
  const [imgError, setImgError] = useState(false);

  const imageUri = uri
    ? uri.startsWith('http') ? uri : null
    : null;

  const hasImage = imageUri && !imgError;

  const initials = name
    ? name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase()
    : '';

  const ringSize = showRing ? size + 6 : size;
  const innerSize = showRing ? size - 2 : size;
  const fontSize = Math.max(10, Math.round(size * 0.38));
  const iconSize = Math.max(16, Math.round(size * 0.5));

  // Cricket-themed icons per type
  const defaultIcon = type === 'team' ? 'shield-half-full' : type === 'player' ? 'cricket' : 'account';

  // Generate a stable gradient from the color
  const gradientColors = [color + 'CC', color + '88'];
  const darkGradient = ['#1a2a3a', '#0d1b2a'];

  const renderContent = () => {
    if (hasImage) {
      return (
        <Image
          source={{ uri: imageUri }}
          style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={200}
          recyclingKey={imageUri}
          onError={() => setImgError(true)}
        />
      );
    }

    if (initials) {
      return (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.initialsWrap,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize, color: '#fff' }]}>{initials}</Text>
        </LinearGradient>
      );
    }

    // Cricket-themed default
    return (
      <LinearGradient
        colors={darkGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.defaultWrap,
          { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
        ]}
      >
        <MaterialCommunityIcons name={defaultIcon} size={iconSize} color={COLORS.TEXT_MUTED} />
      </LinearGradient>
    );
  };

  if (showRing) {
    return (
      <View style={[
        styles.ring,
        {
          width: ringSize, height: ringSize, borderRadius: ringSize / 2,
          borderColor: color, borderWidth: 2,
        },
        style,
      ]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  initialsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  defaultWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(Avatar);
