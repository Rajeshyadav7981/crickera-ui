/**
 * Shared validation utilities.
 * Replaces duplicate validation logic across auth/form screens.
 */

export const validateMobile = (mobile) => {
  const clean = (mobile || '').replace(/\D/g, '');
  if (clean.length !== 10) return { valid: false, error: 'Enter a valid 10-digit mobile number' };
  if (!/^[6-9]/.test(clean)) return { valid: false, error: 'Indian mobile numbers start with 6-9' };
  if (/^(\d)\1{9}$/.test(clean)) return { valid: false, error: 'Invalid number' };
  return { valid: true, error: null };
};

export const validateEmail = (email) => {
  if (!email) return { valid: true, error: null }; // optional
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return { valid: ok, error: ok ? null : 'Enter a valid email (e.g. name@example.com)' };
};

export const validatePassword = (pw) => {
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);
  const longEnough = (pw || '').length >= 8;
  const isValid = hasLetter && hasNumber && hasSpecial && longEnough;

  const missing = [];
  if (!hasLetter) missing.push('a letter (a-z)');
  if (!hasNumber) missing.push('a number (0-9)');
  if (!hasSpecial) missing.push('a special character (!@#$...)');
  if (!longEnough) missing.push('at least 8 characters');

  return { isValid, hasLetter, hasNumber, hasSpecial, longEnough, missing };
};

export const validateUsername = (username) => {
  const clean = (username || '').toLowerCase().trim();
  if (clean.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (clean.length > 30) return { valid: false, error: 'Username must be under 30 characters' };
  if (!/^[a-z0-9_]+$/.test(clean)) return { valid: false, error: 'Only lowercase letters, numbers, and underscores' };
  return { valid: true, error: null };
};

export const validateName = (name, label = 'Name') => {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return { valid: false, error: `${label} must be at least 2 characters` };
  if (trimmed.length > 30) return { valid: false, error: `${label} must be under 30 characters` };
  return { valid: true, error: null };
};
