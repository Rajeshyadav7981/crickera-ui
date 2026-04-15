/**
 * Divider — 1px line in theme border color.
 * Replaces inline <View style={{ height: 1, backgroundColor: COLORS.BORDER }} />
 */
import React from 'react';
import { View } from 'react-native';
import { COLORS } from '../theme';

const Divider = ({ inset = 0, vertical = false, color, style }) => (
  <View
    style={[
      vertical
        ? { width: 1, alignSelf: 'stretch' }
        : { height: 1, alignSelf: 'stretch', marginLeft: inset },
      { backgroundColor: color || COLORS.BORDER },
      style,
    ]}
  />
);

export default React.memo(Divider);
