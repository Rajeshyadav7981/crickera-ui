import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { useFavoriteIds } from '../hooks/useFavorites';
import { useRequireAuth } from '../hooks/useRequireAuth';

const FavoriteButton = ({
  entityType,
  entityId,
  size = 18,
  variant = 'card',
  style,
}) => {
  const { isMatchFavorite, isTournamentFavorite, toggleMatch, toggleTournament } = useFavoriteIds();
  const requireAuth = useRequireAuth();
  const scale = useRef(new Animated.Value(1)).current;

  if (!entityId) return null;

  const isFav = entityType === 'match'
    ? isMatchFavorite(entityId)
    : isTournamentFavorite(entityId);

  const onPress = (e) => {
    e?.stopPropagation?.();
    if (!requireAuth('add to favorites')) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
    if (entityType === 'match') toggleMatch(entityId);
    else toggleTournament(entityId);
  };

  const containerStyle = [
    variant === 'card' ? s.cardOverlay : s.headerBtn,
    isFav && variant === 'card' && s.cardOverlayActive,
    style,
  ];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      style={containerStyle}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <MaterialCommunityIcons
          name={isFav ? 'heart' : 'heart-outline'}
          size={size}
          color={isFav ? COLORS.ACCENT_LIGHT : (variant === 'card' ? COLORS.TEXT_SECONDARY : COLORS.TEXT_MUTED)}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  cardOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  cardOverlayActive: {
    backgroundColor: 'rgba(30,136,229,0.20)',
    borderColor: 'rgba(66,165,245,0.45)',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(FavoriteButton);
