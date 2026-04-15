import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme';
import Icon from './Icon';

const HeaderBar = ({
  title,
  showBack = true,
  onBack,
  rightIcon,
  onRightPress,
  rightComponent,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const handleBack = onBack || (() => navigation.goBack());

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, style]}>
      {showBack ? (
        <TouchableOpacity onPress={handleBack} style={styles.btn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="back" size={22} />
        </TouchableOpacity>
      ) : (
        <View style={styles.btn} />
      )}
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {rightComponent ? rightComponent : rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={styles.btn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name={rightIcon} size={22} />
        </TouchableOpacity>
      ) : (
        <View style={styles.btn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.BG,
  },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.TEXT,
    textAlign: 'center', marginHorizontal: 8,
  },
});

export default React.memo(HeaderBar);
