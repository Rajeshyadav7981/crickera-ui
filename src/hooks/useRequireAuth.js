import { useCallback, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSignInPrompt } from '../components/SignInPrompt';

/**
 * Inline guard for event handlers.
 *
 * Usage:
 *   const requireAuth = useRequireAuth();
 *   const handleCreate = () => {
 *     if (!requireAuth('create a match')) return;
 *     // ...proceed
 *   };
 *
 * Returns `true` if signed in (proceed), or shows a themed sign-in prompt
 * and returns `false`.
 */
export const useRequireAuth = () => {
  const { user } = useAuth();
  const { promptSignIn } = useSignInPrompt();

  return useCallback((actionLabel = 'continue') => {
    if (user) return true;
    promptSignIn(actionLabel);
    return false;
  }, [user, promptSignIn]);
};

/**
 * Screen-level auth gate: if the user is not signed in when a protected
 * screen mounts, show the themed sign-in prompt and bounce them back to
 * the previous screen on cancel.
 *
 * Usage:
 *   const { user, ready } = useAuthGate('create a tournament');
 */
export const useAuthGate = (actionLabel = 'access this page') => {
  const { user, loading } = useAuth();
  const navigation = useNavigation();
  const { promptSignIn } = useSignInPrompt();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user && !promptedRef.current) {
      promptedRef.current = true;
      promptSignIn(actionLabel, {
        onCancel: () => {
          // Return the user to where they came from
          if (navigation.canGoBack()) navigation.goBack();
          else navigation.navigate('MainTabs');
        },
      });
    }
    if (user) promptedRef.current = false;
  }, [loading, user, navigation, actionLabel, promptSignIn]);

  return { user, ready: !loading && !!user };
};

export default useRequireAuth;
