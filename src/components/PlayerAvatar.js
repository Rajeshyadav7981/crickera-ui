import React from 'react';
import Avatar from './Avatar';

const pickUri = (p) =>
  p?.profile_image || p?.profile || p?.image || p?.player_image || null;

const pickName = (p) =>
  p?.full_name
    || p?.player_name
    || p?.name
    || [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
    || 'Unknown';

const PlayerAvatar = ({ player, size = 36, color, ...rest }) => {
  if (!player) return null;
  return (
    <Avatar
      uri={pickUri(player)}
      name={pickName(player)}
      size={size}
      color={color}
      type="player"
      {...rest}
    />
  );
};

export default PlayerAvatar;
