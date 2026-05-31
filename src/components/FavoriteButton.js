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
    variant === 'card' ? s.cardSlot : s.headerBtn,
    style,
  ];

  const iconColor = isFav
    ? COLORS.ACCENT_LIGHT
    : (variant === 'card' ? 'rgba(255,255,255,0.78)' : COLORS.TEXT_MUTED);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      style={containerStyle}
    >
      <Animated.View style={[s.iconWrap, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons
          name={isFav ? 'heart' : 'heart-outline'}
          size={size}
          color={iconColor}
          style={variant === 'card' ? s.iconShadow : null}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  cardSlot: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
    zIndex: 10,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconShadow: Platform.select({
    ios: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    android: { textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  }),
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(FavoriteButton);
