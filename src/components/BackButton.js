import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme';

const BackButton = ({ onPress, style, size = 36, color = COLORS.TEXT }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.6}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    style={[s.btn, { width: size, height: size, borderRadius: size / 2 }, style]}
  >
    <Svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19l-7-7 7-7"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
});

export default BackButton;
