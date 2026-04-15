import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './src/hooks/useQueryClient';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/Toast';
import NetworkBar from './src/components/NetworkBar';
import AppNavigator from './src/navigation/AppNavigator';

const StatusBarWithTheme = () => {
  const { isDark } = useThemeContext();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
};

export default function App() {
  const appContent = (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <StatusBarWithTheme />
              <NetworkBar />
              <AppNavigator />
            </ToastProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.mobileFrame}>
          {appContent}
        </View>
      </View>
    );
  }

  return appContent;
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileFrame: {
    width: 390,
    height: 844,
    backgroundColor: '#0D0D0D',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
});
