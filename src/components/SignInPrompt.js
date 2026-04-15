import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TouchableWithoutFeedback,
  Animated, Easing, Platform,
} from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, GRADIENTS } from '../theme';

/** Shared navigation ref — set this on NavigationContainer so the
 *  sign-in modal (which lives outside the navigator tree) can navigate. */
export const navigationRef = createNavigationContainerRef();

const safeNavigate = (name, params) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
};

/**
 * SignInPromptContext — lets any component trigger a themed sign-in prompt.
 *
 * Usage:
 *   const { promptSignIn } = useSignInPrompt();
 *   if (!user) { promptSignIn('create a match'); return; }
 */
const SignInPromptContext = createContext({
  promptSignIn: () => {},
  hideSignInPrompt: () => {},
});

export const useSignInPrompt = () => useContext(SignInPromptContext);

const ICON_BY_LABEL = (label = '') => {
  const l = label.toLowerCase();
  if (l.includes('match')) return 'cricket';
  if (l.includes('tournament')) return 'trophy-outline';
  if (l.includes('team')) return 'account-group-outline';
  if (l.includes('stat')) return 'chart-line';
  if (l.includes('post') || l.includes('comment') || l.includes('like') || l.includes('vote') || l.includes('reply')) return 'comment-text-outline';
  if (l.includes('profile')) return 'account-edit-outline';
  return 'lock-outline';
};

export const SignInPromptProvider = ({ children }) => {
  const [state, setState] = useState({ visible: false, label: 'continue' });
  const onCancelRef = useRef(null);

  const promptSignIn = useCallback((label = 'continue', opts = {}) => {
    onCancelRef.current = opts.onCancel || null;
    setState({ visible: true, label });
  }, []);

  const hideSignInPrompt = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  return (
    <SignInPromptContext.Provider value={{ promptSignIn, hideSignInPrompt }}>
      {children}
      <SignInPromptModal
        visible={state.visible}
        label={state.label}
        onClose={() => {
          if (onCancelRef.current) onCancelRef.current();
          hideSignInPrompt();
        }}
      />
    </SignInPromptContext.Provider>
  );
};

const SignInPromptModal = ({ visible, label, onClose }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  const goToLogin = () => {
    onClose();
    // slight delay so modal exit doesn't fight with navigation push
    setTimeout(() => safeNavigate('Login'), 50);
  };

  const goToRegister = () => {
    onClose();
    setTimeout(() => safeNavigate('Register'), 50);
  };

  const iconName = ICON_BY_LABEL(label);
  const actionText = label || 'continue';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
              {/* Close (X) */}
              <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.TEXT_MUTED} />
              </TouchableOpacity>

              {/* Icon hero */}
              <View style={s.iconWrap}>
                <LinearGradient
                  colors={['rgba(30,136,229,0.28)', 'rgba(30,136,229,0.05)']}
                  style={s.iconGradient}
                >
                  <View style={s.iconInner}>
                    <MaterialCommunityIcons name={iconName} size={36} color={COLORS.ACCENT_LIGHT} />
                  </View>
                </LinearGradient>
              </View>

              {/* Title + body */}
              <Text style={s.title}>Sign in required</Text>
              <Text style={s.subtitle}>
                You need an account to <Text style={s.subtitleStrong}>{actionText}</Text>.
                {'\n'}Join CrecKStars — it only takes a minute.
              </Text>

              {/* Primary action — Sign In */}
              <TouchableOpacity style={s.primaryBtn} onPress={goToLogin} activeOpacity={0.85}>
                <LinearGradient
                  colors={GRADIENTS.BUTTON}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryBtnInner}
                >
                  <MaterialCommunityIcons name="login" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>Sign In</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Secondary — Create Account */}
              <TouchableOpacity style={s.secondaryBtn} onPress={goToRegister} activeOpacity={0.75}>
                <MaterialCommunityIcons name="account-plus-outline" size={18} color={COLORS.TEXT} />
                <Text style={s.secondaryBtnText}>Create Account</Text>
              </TouchableOpacity>

              {/* Tertiary — Not now */}
              <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.cancelBtnText}>Not now</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.CARD,
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(30,136,229,0.4)',
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(30,136,229,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 22,
  },
  subtitleStrong: {
    color: COLORS.TEXT,
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: COLORS.ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    marginBottom: 4,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_MUTED,
  },
});

export default SignInPromptProvider;
