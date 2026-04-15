/**
 * ConfirmModal — themed confirmation dialog matching the InningsEndDialog
 * blue/black look. Replaces native Alert.alert for in-app confirmations.
 *
 * Usage:
 *   <ConfirmModal
 *     visible={open}
 *     icon="undo-variant"
 *     title="Undo Last Ball"
 *     message="Revert the last delivery? This will reopen the over."
 *     confirmText="Yes, Undo"
 *     cancelText="Cancel"
 *     destructive
 *     onConfirm={...}
 *     onCancel={...}
 *   />
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated, Platform, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

const ConfirmModal = ({
  visible,
  icon = 'help-circle-outline',
  iconColor,                  // override; defaults based on destructive
  title = 'Confirm',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();

  // Entrance animation — fade + spring scale, mirrors InningsEndDialog
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
    }
  }, [visible]);

  const heroIconColor = iconColor
    || (destructive ? COLORS.DANGER_LIGHT : COLORS.ACCENT_LIGHT);
  const heroGradient = destructive
    ? ['rgba(229,57,53,0.32)', 'rgba(229,57,53,0.04)']
    : ['rgba(30,136,229,0.32)', 'rgba(30,136,229,0.04)'];
  const heroBorder = destructive
    ? 'rgba(229,57,53,0.45)'
    : 'rgba(30,136,229,0.45)';
  const buttonGradient = destructive
    ? [COLORS.RED, '#B91C1C']
    : GRADIENTS.BUTTON;
  const buttonShadowColor = destructive ? COLORS.RED : COLORS.ACCENT;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={loading ? undefined : onCancel}>
        <Animated.View
          style={[
            styles.overlay,
            { opacity: fadeAnim, paddingTop: insets.top, paddingBottom: insets.bottom },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.modal, { transform: [{ scale: scaleAnim }] }]}>
              {/* Subtle blue glow at the top of the card for depth */}
              <LinearGradient
                colors={destructive
                  ? ['rgba(229,57,53,0.08)', 'transparent']
                  : ['rgba(30,136,229,0.10)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.cardGlow}
                pointerEvents="none"
              />

              {/* Hero icon */}
              <View style={styles.heroWrap}>
                <LinearGradient colors={heroGradient} style={[styles.heroRing, { borderColor: heroBorder }]}>
                  <View style={styles.heroInner}>
                    <MaterialCommunityIcons name={icon} size={36} color={heroIconColor} />
                  </View>
                </LinearGradient>
              </View>

              {/* Title + message */}
              <Text style={styles.title}>{title}</Text>
              {!!message && <Text style={styles.message}>{message}</Text>}

              {/* Actions */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onCancel}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtnWrap,
                    {
                      shadowColor: buttonShadowColor,
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 14,
                    },
                    loading && { opacity: 0.7 },
                  ]}
                  onPress={onConfirm}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.confirmBtnInner}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.confirmText}>{confirmText}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.CARD,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.18)',
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 28,
      },
      android: { elevation: 14 },
    }),
  },
  cardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },

  // Hero
  heroWrap: {
    alignItems: 'center',
    marginBottom: 14,
  },
  heroRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heroInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },

  // Text
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  confirmBtnWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 6,
  },
  confirmBtnInner: {
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

export default React.memo(ConfirmModal);
