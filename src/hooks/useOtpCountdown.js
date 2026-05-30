import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Drives the two timers an OTP screen needs:
 *   - expiresIn: seconds the current code is still valid (for "Code expires in M:SS")
 *   - resendIn:  cooldown before "Resend OTP" is allowed again (in-app rate-limit guard)
 *
 * Call start(validitySeconds) right after a successful send/resend. The backend
 * returns the real validity in send-otp's `expires_in` (VerifyNow ≈ 60s), so the
 * UI shows the true window instead of a hardcoded guess.
 */
export default function useOtpCountdown() {
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const tick = useRef(null);

  useEffect(() => {
    if (expiresIn <= 0 && resendIn <= 0) return undefined;
    tick.current = setTimeout(() => {
      setExpiresIn((v) => (v > 0 ? v - 1 : 0));
      setResendIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearTimeout(tick.current);
  }, [expiresIn, resendIn]);

  const start = useCallback((validitySeconds, resendCooldown) => {
    const v = Number(validitySeconds) || 60;
    setExpiresIn(v);
    // VerifyNow rejects a new send while an OTP is still active
    // (REQUEST_ALREADY_EXISTS), so by default resend only unlocks once the
    // current code has expired. A caller may pass a shorter cooldown explicitly.
    const cd = resendCooldown == null ? v : Math.min(resendCooldown, v);
    setResendIn(cd);
  }, []);

  const reset = useCallback(() => {
    setExpiresIn(0);
    setResendIn(0);
  }, []);

  return {
    expiresIn,
    resendIn,
    expired: expiresIn === 0,
    canResend: resendIn === 0,
    start,
    reset,
  };
}

/** 90 -> "1:30", 45 -> "45s". */
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}
