import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { appAPI } from '../services/api';
import Constants from 'expo-constants';

const APP_VERSION = Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0';

/**
 * Checks the backend for app updates on mount.
 * - force_update: Shows a non-dismissable alert with only "Update Now"
 * - update_available: Shows a dismissable alert with "Update" and "Later"
 *
 * Only runs once per app session (uses ref to track).
 */
export const useUpdateCheck = () => {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || Platform.OS === 'web') return;
    checked.current = true;

    (async () => {
      try {
        const res = await appAPI.checkVersion(APP_VERSION);
        const data = res.data;
        if (!data) return;

        const openDownload = () => {
          if (data.download_url) {
            Linking.openURL(data.download_url).catch(() => {});
          }
        };

        if (data.force_update) {
          Alert.alert(
            'Update Required',
            `A new version (v${data.latest_version}) is required to continue using CrecKStars.\n\n${data.release_notes || ''}`,
            [{ text: 'Update Now', onPress: openDownload }],
            { cancelable: false },
          );
        } else if (data.update_available) {
          Alert.alert(
            'Update Available',
            `CrecKStars v${data.latest_version} is available (you have v${APP_VERSION}).\n\n${data.release_notes || ''}`,
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Update', onPress: openDownload },
            ],
          );
        }
      } catch {
        // Silent — don't block app launch if version check fails
      }
    })();
  }, []);
};
