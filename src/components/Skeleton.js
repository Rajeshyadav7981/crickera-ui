import React, { useEffect } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../theme';

// Shared animation driver — all skeleton instances pulse together
// instead of each running its own animation loop
const sharedShimmer = new Animated.Value(0);
let sharedAnimationRefCount = 0;
let sharedAnimation = null;

function startSharedAnimation() {
  if (sharedAnimation) return;
  sharedAnimation = Animated.loop(
    Animated.sequence([
      Animated.timing(sharedShimmer, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(sharedShimmer, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])
  );
  sharedAnimation.start();
}

function stopSharedAnimation() {
  if (sharedAnimation) {
    sharedAnimation.stop();
    sharedAnimation = null;
    sharedShimmer.setValue(0);
  }
}

const sharedOpacity = sharedShimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

const Skeleton = ({ width = '100%', height = 16, borderRadius = 8, style }) => {
  useEffect(() => {
    sharedAnimationRefCount++;
    if (sharedAnimationRefCount === 1) {
      startSharedAnimation();
    }
    return () => {
      sharedAnimationRefCount--;
      if (sharedAnimationRefCount === 0) {
        stopSharedAnimation();
      }
    };
  }, []);

  return (
    <Animated.View style={[sk.base, { width, height, borderRadius, opacity: sharedOpacity }, style]} />
  );
};

// Skeleton mirrors the compact MatchCard (single-line team rows, inline score).
export const MatchCardSkeleton = () => (
  <View style={sk.matchCard}>
    <View style={[sk.row, { gap: 5 }]}>
      <Skeleton width={40} height={16} borderRadius={4} />
      <Skeleton width={32} height={16} borderRadius={4} />
      <Skeleton width={60} height={10} borderRadius={3} />
    </View>
    <View style={[sk.row, { gap: 8, marginTop: 10 }]}>
      <Skeleton width={24} height={24} borderRadius={12} />
      <Skeleton width="45%" height={13} borderRadius={3} />
      <View style={{ flex: 1 }} />
      <Skeleton width={54} height={14} borderRadius={3} />
    </View>
    <View style={[sk.row, { gap: 8, marginTop: 6 }]}>
      <Skeleton width={24} height={24} borderRadius={12} />
      <Skeleton width="40%" height={13} borderRadius={3} />
      <View style={{ flex: 1 }} />
      <Skeleton width={54} height={14} borderRadius={3} />
    </View>
    <View style={[sk.row, { gap: 5, marginTop: 10 }]}>
      <Skeleton width={70} height={18} borderRadius={4} />
      <Skeleton width={52} height={18} borderRadius={4} />
      <Skeleton width={40} height={18} borderRadius={4} />
    </View>
  </View>
);

export const ProfileSkeleton = () => (
  <View style={sk.profile}>
    <Skeleton width={80} height={80} borderRadius={40} />
    <Skeleton width={150} height={20} style={{ marginTop: 12 }} />
    <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
    <View style={[sk.row, { marginTop: 20, gap: 10 }]}>
      {[1,2,3,4].map(i => (
        <Skeleton key={i} width={70} height={60} borderRadius={12} />
      ))}
    </View>
  </View>
);

export const PostCardSkeleton = () => (
  <View style={sk.postCard}>
    <View style={sk.row}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="30%" height={10} style={{ marginTop: 4 }} />
      </View>
    </View>
    <Skeleton width="90%" height={14} style={{ marginTop: 12 }} />
    <Skeleton width="70%" height={14} style={{ marginTop: 6 }} />
    <Skeleton width="100%" height={1} style={{ marginTop: 12 }} />
    <View style={[sk.row, { marginTop: 10 }]}>
      <Skeleton width={50} height={20} borderRadius={4} />
      <Skeleton width={50} height={20} borderRadius={4} />
      <Skeleton width={50} height={20} borderRadius={4} />
    </View>
  </View>
);

export const ListSkeleton = ({ count = 3, Card = MatchCardSkeleton }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => <Card key={i} />)}
  </View>
);

export const HorizontalSkeleton = ({ count = 3 }) => (
  <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} width={160} height={120} borderRadius={14} />
    ))}
  </View>
);

const sk = StyleSheet.create({
  base: { backgroundColor: COLORS.SURFACE },
  matchCard: {
    backgroundColor: COLORS.BG, marginHorizontal: 12, marginBottom: 10,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.BORDER,
    padding: 10,
  },
  postCard: {
    backgroundColor: COLORS.CARD, marginHorizontal: 12, marginBottom: 10,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.BORDER,
  },
  profile: { alignItems: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
});

export default React.memo(Skeleton);
