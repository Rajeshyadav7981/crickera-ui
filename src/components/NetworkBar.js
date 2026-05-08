import React, { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useToast } from './Toast';

// Headless network watcher. No persistent banner — screens keep showing their
// normal loading state while offline, and we raise a toast only on the edges
// (going offline, coming back online) so the user isn't left guessing why
// nothing loaded.
const NetworkStatus = () => {
  const toast = useToast();
  // Treat the app as "connected until proven otherwise" so we don't fire a
  // stale toast on cold start before NetInfo has resolved the real state.
  const wasConnectedRef = useRef(true);
  const hasReceivedFirstEventRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null in Expo Go — only treat explicit false as offline.
      const connected = state.isConnected !== false && state.isInternetReachable !== false;

      // Skip the first event if it matches our optimistic default — prevents
      // a spurious "Back online" toast on launch.
      if (!hasReceivedFirstEventRef.current) {
        hasReceivedFirstEventRef.current = true;
        wasConnectedRef.current = connected;
        if (!connected) {
          toast.error('No internet connection', 'Some content may not load');
        }
        return;
      }

      if (connected === wasConnectedRef.current) return;
      wasConnectedRef.current = connected;
      if (connected) {
        toast.success('Back online');
      } else {
        toast.error('No internet connection', 'Some content may not load');
      }
    });
    return () => unsubscribe();
  }, [toast]);

  return null;
};

export default React.memo(NetworkStatus);
