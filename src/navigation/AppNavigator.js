import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { useAuth } from '../context/AuthContext';
import { useThemeContext } from '../context/ThemeContext';
import { COLORS } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { linkingConfig } from '../services/linking';
import offlineQueue from '../services/offlineQueue';
import { useUpdateCheck } from '../hooks/useUpdateCheck';

// Freeze screens not in view to save memory and CPU
enableFreeze(true);

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { SignInPromptProvider, navigationRef } from '../components/SignInPrompt';

import HomeTab from '../screens/tabs/HomeTab';
import TournamentsTab from '../screens/tabs/TournamentsTab';
import CommunityTab from '../screens/tabs/CommunityTab';
import ProfileTab from '../screens/tabs/ProfileTab';

import CreateTournamentScreen from '../screens/tournament/CreateTournamentScreen';
import TournamentDetailScreen from '../screens/tournament/TournamentDetailScreen';
import CreateTeamScreen from '../screens/team/CreateTeamScreen';
import TeamDetailScreen from '../screens/team/TeamDetailScreen';
import MyTeamsScreen from '../screens/team/MyTeamsScreen';
import AddPlayerScreen from '../screens/team/AddPlayerScreen';
import CreateMatchScreen from '../screens/match/CreateMatchScreen';
import TossScreen from '../screens/match/TossScreen';
import SelectSquadScreen from '../screens/match/SelectSquadScreen';
import SelectOpenersScreen from '../screens/match/SelectOpenersScreen';
import LiveScoringScreen from '../screens/match/LiveScoringScreen';
import ScorecardScreen from '../screens/match/ScorecardScreen';
import MatchDetailScreen from '../screens/match/MatchDetailScreen';
import QuickMatchScreen from '../screens/match/QuickMatchScreen';
import MyMatchesScreen from '../screens/match/MyMatchesScreen';
import MyTournamentsScreen from '../screens/tournament/MyTournamentsScreen';
import PlayerProfileScreen from '../screens/player/PlayerProfileScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import UsernameSetupScreen from '../screens/profile/UsernameSetupScreen';
import UserPublicProfileScreen from '../screens/profile/UserPublicProfileScreen';
import MyStatsScreen from '../screens/profile/MyStatsScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import HelpScreen from '../screens/profile/HelpScreen';
import HashtagFeedScreen from '../screens/community/HashtagFeedScreen';
import PointsTableScreen from '../screens/tournament/PointsTableScreen';
import LeaderboardScreen from '../screens/tournament/LeaderboardScreen';
import TournamentSetupScreen from '../screens/tournament/TournamentSetupScreen';
import Icon from '../components/Icon';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const tabIconKeys = { Home: 'home', Tournaments: 'tournaments', Community: 'community', Profile: 'profile' };
const tabLabels = { Home: 'Home', Tournaments: 'Tourneys', Community: 'Community', Profile: 'Profile' };

// ── Simple Fast Tab Bar ──
const SimpleTabBar = React.memo(({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors: C } = useThemeContext();
  const bottomPad = Platform.OS === 'ios' ? insets.bottom : 8;

  return (
    <View style={[ts.bar, { paddingBottom: bottomPad, backgroundColor: C.BG, borderTopColor: C.BORDER }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity key={route.key} onPress={onPress} activeOpacity={0.7} style={ts.tab}>
            <View style={[ts.iconWrap, focused && ts.iconWrapActive]}>
              <Icon name={tabIconKeys[route.name]} size={22} color={focused ? C.ACCENT : C.TEXT_MUTED} active={focused} />
            </View>
            <Text style={[ts.label, { color: C.TEXT_MUTED }, focused && { color: C.ACCENT, fontWeight: '700' }]}>{tabLabels[route.name]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ts = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconWrapActive: {},
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
});

const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <SimpleTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      lazy: true,
      freezeOnBlur: true,
      detachInactiveScreens: true,
    }}
  >
    <Tab.Screen name="Home" component={HomeTab} />
    <Tab.Screen name="Tournaments" component={TournamentsTab} />
    <Tab.Screen name="Community" component={CommunityTab} />
    <Tab.Screen name="Profile" component={ProfileTab} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { isDark, colors: C } = useThemeContext();
  const [showSplash, setShowSplash] = useState(true);

  // Initialize offline queue
  useEffect(() => {
    offlineQueue.init();
    return () => offlineQueue.destroy();
  }, []);

  // Check for app updates on launch
  useUpdateCheck();

  if (loading || showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer ref={navigationRef} key={isDark ? 'dark' : 'light'} linking={linkingConfig} theme={{
      dark: isDark,
      colors: {
        primary: C.ACCENT,
        background: C.BG,
        card: C.CARD,
        text: C.TEXT,
        border: C.BORDER,
        notification: C.ACCENT,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' },
        medium: { fontFamily: 'System', fontWeight: '500' },
        bold: { fontFamily: 'System', fontWeight: '700' },
        heavy: { fontFamily: 'System', fontWeight: '900' },
      },
    }}>
      <SignInPromptProvider>
      <Stack.Navigator screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        detachInactiveScreens: true,
      }}>
        {/* Main tabs always available — guest users land here first */}
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
        {/* Auth screens — accessible from anywhere when user triggers a protected action */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ animation: 'slide_from_right' }} />
        {/* Feature screens — some require auth (gated via useRequireAuth inside the screen) */}
        <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="TournamentSetup" component={TournamentSetupScreen} />
        <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
        <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="TeamDetail" component={TeamDetailScreen} />
        <Stack.Screen name="MyTeams" component={MyTeamsScreen} />
        <Stack.Screen name="AddPlayer" component={AddPlayerScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="QuickMatch" component={QuickMatchScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="MyMatches" component={MyMatchesScreen} />
        <Stack.Screen name="MyTournaments" component={MyTournamentsScreen} />
        <Stack.Screen name="Toss" component={TossScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="SelectSquad" component={SelectSquadScreen} />
        <Stack.Screen name="SelectOpeners" component={SelectOpenersScreen} />
        <Stack.Screen name="LiveScoring" component={LiveScoringScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Scorecard" component={ScorecardScreen} />
        <Stack.Screen name="MatchDetail" component={MatchDetailScreen} />
        <Stack.Screen name="PlayerProfile" component={PlayerProfileScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="MyStats" component={MyStatsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="UsernameSetup" component={UsernameSetupScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="UserPublicProfile" component={UserPublicProfileScreen} />
        <Stack.Screen name="HashtagFeed" component={HashtagFeedScreen} />
        <Stack.Screen name="PointsTable" component={PointsTableScreen} />
        <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
      </Stack.Navigator>
      </SignInPromptProvider>
    </NavigationContainer>
  );
};

export default AppNavigator;
