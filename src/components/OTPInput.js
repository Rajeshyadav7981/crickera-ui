import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, Animated, Platform, Dimensions } from 'react-native';
import { COLORS, FONTS } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
// Card padding (24×2) + screen padding (24×2) + gap between 6 boxes (5×8)
// Leaves remaining width split across 6 boxes
const BOX_SIZE = Math.min(48, Math.floor((SCREEN_W - 96 - 40) / 6));

const DIGITS = 6;

/**
 * 6-digit OTP input — each digit in its own box, auto-advance, paste support.
 *
 * Props:
 *   value: string (current OTP code, up to 6 chars)
 *   onChange: (code: string) => void
 *   autoFocus?: boolean (default true)
 *   error?: boolean (shake + red border on wrong OTP)
 */
const OTPInput = ({ value = '', onChange, autoFocus = true, error = false }) => {
  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(autoFocus);

  // Shake on error
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  // Auto focus
  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []);

  const handleChange = (text) => {
    // Only digits, max 6. We intentionally do NOT dismiss the keyboard on the
    // 6th digit — auto-dismiss left the user unable to backspace/edit without
    // reopening (and reopening dropped the cursor at position 0).
    const clean = text.replace(/[^0-9]/g, '').slice(0, DIGITS);
    onChange(clean);
  };

  const digits = value.split('');
  const activeIndex = Math.min(digits.length, DIGITS - 1);

  return (
    <View>
      <Animated.View
        style={[s.container, { transform: [{ translateX: shakeAnim }] }]}
      >
        {/* Visible digit boxes */}
        {Array.from({ length: DIGITS }).map((_, i) => {
          const filled = i < digits.length;
          const isActive = focused && i === digits.length;
          const isError = error && filled;

          return (
            <View
              key={i}
              style={[
                s.box,
                filled && s.boxFilled,
                isActive && s.boxActive,
                isError && s.boxError,
              ]}
            >
              {filled ? (
                <Text style={[s.digit, isError && s.digitError]}>{digits[i]}</Text>
              ) : isActive ? (
                <CursorBlink />
              ) : (
                <View style={s.dot} />
              )}
            </View>
          );
        })}

        {/* Transparent full-size input overlay. Sits on top of the boxes and
            captures taps natively, so the keyboard opens AND reliably RE-opens
            after being dismissed (the old 1x1 hidden input + onTouchEnd forward
            failed to reopen). The boxes show through and render the digits. */}
        <TextInput
          ref={inputRef}
          style={s.overlayInput}
          value={value}
          // Pin the cursor to the end so backspace always deletes the last
          // digit (otherwise a re-focus can place the caret at position 0).
          selection={{ start: value.length, end: value.length }}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={DIGITS}
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          textContentType="oneTimeCode"
          importantForAutofill="yes"
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
          contextMenuHidden
          selectionColor="transparent"
          cursorColor="transparent"
        />
      </Animated.View>

      {/* Helper text */}
      <Text style={s.helperText}>
        {value.length === DIGITS ? 'Ready to verify' : `${value.length} of ${DIGITS} digits`}
      </Text>
    </View>
  );
};

// Blinking cursor in active empty box
const CursorBlink = () => {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={[s.cursor, { opacity }]} />;
};

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: COLORS.ACCENT,
    backgroundColor: COLORS.ACCENT_SOFT,
  },
  boxActive: {
    borderColor: COLORS.ACCENT,
    borderWidth: 2.5,
  },
  boxError: {
    borderColor: COLORS.LIVE,
    backgroundColor: COLORS.LIVE_BG,
  },
  digit: {
    fontFamily: FONTS.family,    fontSize: Math.min(24, BOX_SIZE * 0.5),
    fontWeight: '800',
    color: COLORS.TEXT,
    letterSpacing: 0,
  },
  digitError: {
    color: COLORS.LIVE,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.BORDER_LIGHT,
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.ACCENT,
    borderRadius: 1,
  },
  overlayInput: {
    // Cover the whole boxes row; opacity:0 hides EVERYTHING (text, caret,
    // selection) so no stray black caret/character shows over the styled
    // boxes, while the input stays fully interactive (tap = open/reopen kbd).
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  helperText: {
    fontFamily: FONTS.family,    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});

export default React.memo(OTPInput);
