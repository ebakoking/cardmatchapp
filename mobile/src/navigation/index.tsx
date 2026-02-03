import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

// Auth Screens
import LandingScreen from '../screens/Auth/LandingScreen';
import EmailAuthScreen from '../screens/Auth/EmailAuthScreen';
import PhoneVerificationScreen from '../screens/Onboarding/PhoneVerificationScreen';

// Onboarding Screens
import ProfileSetupScreen from '../screens/Onboarding/ProfileSetupScreen';
import PhotoUploadScreen from '../screens/Onboarding/PhotoUploadScreen';
import BioInputScreen from '../screens/Onboarding/BioInputScreen';
import VerificationVideoScreen from '../screens/Onboarding/VerificationVideoScreen';
import TutorialScreen from '../screens/Onboarding/TutorialScreen';
import AvatarSelectionScreen from '../screens/Onboarding/AvatarSelectionScreen';

// Main Screens
import HomeScreen from '../screens/Home/HomeScreen';
import MatchQueueScreen from '../screens/Match/MatchQueueScreen';
import CardGateScreen from '../screens/Match/CardGateScreen';
import MatchSettingsScreen from '../screens/Match/MatchSettingsScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import VerificationSelfieScreen from '../screens/Profile/VerificationSelfieScreen';
import InterestsScreen from '../screens/Profile/InterestsScreen';
import {
  ChangeNicknameScreen,
  ChangeEmailScreen,
  ChangePasswordScreen,
  BlockedUsersScreen,
  DeleteConversationsScreen,
  AppLockScreen,
  HelpScreen,
  FeedbackScreen,
} from '../screens/Profile/SettingsScreens';
import FriendsScreen from '../screens/Friends/FriendsScreen';
import FriendChatScreen from '../screens/Friends/FriendChatScreen';
import FriendProfileScreen from '../screens/Friends/FriendProfileScreen';
import LeaderboardScreen from '../screens/Leaderboard/LeaderboardScreen';
import SubscriptionScreen from '../screens/Subscription/SubscriptionScreen';
import TokenPurchaseScreen from '../screens/Subscription/TokenPurchaseScreen';

// Legal Screens
import PrivacyPolicyScreen from '../screens/Legal/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/Legal/TermsOfServiceScreen';

// ============ TYPE DEFINITIONS ============

export type AuthStackParamList = {
  Landing: undefined;
  EmailAuth: undefined;
  PhoneVerification: undefined;
  ProfileSetup: undefined;
  PhotoUpload: undefined;
  BioInput: undefined;
  VerificationVideo: undefined;
  Tutorial: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
};

export type ChatStackParamList = {
  HomeMain: undefined;
  MatchQueue: undefined;
  MatchSettings: undefined;
  CardGate: { 
    matchId: string; 
    partnerNickname?: string;
    partnerAvatarId?: number;
    commonInterests?: string[];
    isBoostMatch?: boolean;
  };
  Chat: { sessionId: string; partnerNickname: string; partnerId: string; partnerAvatarId?: number };
};

export type MainTabParamList = {
  Home: undefined;
  Friends: undefined;
  Leaderboard: undefined;
  Profile: undefined;
};

export type FriendsStackParamList = {
  FriendsList: undefined;
  FriendChat: {
    friendshipId: string;
    friendNickname: string;
    friendPhoto?: string;
    friendAvatarId?: number;
    friendOnline: boolean;
    friendId: string;
  };
  FriendProfile: {
    friendId: string;
    friendNickname: string;
  };
};

export type SubscriptionStackParamList = {
  Subscription: undefined;
  TokenPurchase: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  AvatarSelection: undefined;
  VerificationSelfie: undefined;
  Interests: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  // Ayarlar ekranları
  ChangeNickname: undefined;
  ChangeEmail: undefined;
  ChangePassword: undefined;
  BlockedUsers: undefined;
  DeleteConversations: undefined;
  AppLock: undefined;
  Help: undefined;
  Feedback: undefined;
};

// RootStackParamList - Modal ekranlar için
export type RootStackParamList = {
  VerificationSelfie: undefined;
};

// ============ NAVIGATORS ============

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();
const SubscriptionStack = createNativeStackNavigator<SubscriptionStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ============ STACK NAVIGATORS ============

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="HomeMain" component={HomeScreen} />
      <ChatStack.Screen name="MatchQueue" component={MatchQueueScreen} />
      <ChatStack.Screen name="MatchSettings" component={MatchSettingsScreen} />
      <ChatStack.Screen name="CardGate" component={CardGateScreen} />
      <ChatStack.Screen name="Chat" component={ChatScreen} />
    </ChatStack.Navigator>
  );
}

function FriendsStackNavigator() {
  return (
    <FriendsStack.Navigator screenOptions={{ headerShown: false }}>
      <FriendsStack.Screen name="FriendsList" component={FriendsScreen} />
      <FriendsStack.Screen name="FriendChat" component={FriendChatScreen} />
      <FriendsStack.Screen name="FriendProfile" component={FriendProfileScreen} />
    </FriendsStack.Navigator>
  );
}

function SubscriptionStackNavigator() {
  return (
    <SubscriptionStack.Navigator screenOptions={{ headerShown: false }}>
      <SubscriptionStack.Screen name="Subscription" component={SubscriptionScreen} />
      <SubscriptionStack.Screen name="TokenPurchase" component={TokenPurchaseScreen} />
    </SubscriptionStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="AvatarSelection" component={AvatarSelectionScreen} />
      <ProfileStack.Screen name="VerificationSelfie" component={VerificationSelfieScreen} />
      <ProfileStack.Screen name="Interests" component={InterestsScreen} />
      <ProfileStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
      {/* Ayarlar Ekranları */}
      <ProfileStack.Screen name="ChangeNickname" component={ChangeNicknameScreen} />
      <ProfileStack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      <ProfileStack.Screen name="DeleteConversations" component={DeleteConversationsScreen} />
      <ProfileStack.Screen name="AppLock" component={AppLockScreen} />
      <ProfileStack.Screen name="Help" component={HelpScreen} />
      <ProfileStack.Screen name="Feedback" component={FeedbackScreen} />
    </ProfileStack.Navigator>
  );
}

// Tab bar icon component
const TabIcon = ({ 
  focused, 
  iconName, 
  label 
}: { 
  focused: boolean; 
  iconName: string; 
  label: string;
}) => {
  return (
    <View style={tabStyles.tabItem}>
      {focused ? (
        <LinearGradient
          colors={[COLORS.accent, COLORS.accentDark]}
          style={tabStyles.activeIconContainer}
        >
          <Ionicons 
            name={iconName as any} 
            size={22} 
            color={COLORS.background} 
          />
        </LinearGradient>
      ) : (
        <View style={tabStyles.inactiveIconContainer}>
          <Ionicons 
            name={iconName as any} 
            size={22} 
            color={COLORS.textMuted} 
          />
        </View>
      )}
      <Text style={[
        tabStyles.tabLabel, 
        focused && tabStyles.tabLabelActive
      ]}>
        {label}
      </Text>
    </View>
  );
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  
  // Android için bottom inset hesapla (minimum 10px)
  const bottomInset = Platform.OS === 'android' ? Math.max(insets.bottom, 10) : insets.bottom;
  
  return (
    <Tab.Navigator 
      screenOptions={{ 
        headerShown: false,
        tabBarStyle: {
          ...tabStyles.tabBar,
          height: Platform.OS === 'ios' ? 88 : 60 + bottomInset,
          paddingBottom: Platform.OS === 'ios' ? 28 : bottomInset,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={ChatStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconName={focused ? 'home' : 'home-outline'} 
              label="Ana Sayfa" 
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconName={focused ? 'people' : 'people-outline'} 
              label="Arkadaşlar" 
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Leaderboard" 
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconName={focused ? 'trophy' : 'trophy-outline'} 
              label="Sıralama" 
            />
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              focused={focused} 
              iconName={focused ? 'person' : 'person-outline'} 
              label="Profil" 
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Tab bar styles
const tabStyles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
    // height ve paddingBottom dinamik olarak MainTabs'ta ayarlanıyor
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  activeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inactiveIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.accent,
    fontWeight: '600',
  },
});

// ============ ROOT NAVIGATOR ============

export function RootNavigator() {
  const { user, loading, onboardingCompleted } = useAuth();

  if (loading) return null;

  // Profil kurulumu tamamlandı mı kontrol et
  const hasDefaultNickname = user?.nickname?.startsWith('user_') || 
                              user?.nickname?.startsWith('apple_') || 
                              user?.nickname?.startsWith('google_') ||
                              user?.nickname?.startsWith('email_');
  
  const hasCompletedProfile = !!(
    user &&
    user.nickname &&
    !hasDefaultNickname &&
    user.birthDate &&
    user.city &&
    user.age &&
    user.gender &&
    user.interestedIn
  );

  // Onboarding kontrolü
  const isOnboarded = onboardingCompleted || hasCompletedProfile;
  
  console.log('[Navigation] user:', user?.nickname, 'isOnboarded:', isOnboarded, 'hasCompletedProfile:', hasCompletedProfile);

  return (
    <NavigationContainer>
      {!user ? (
        // Kullanıcı giriş yapmamış - Auth akışı
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Landing" component={LandingScreen} />
          <AuthStack.Screen name="EmailAuth" component={EmailAuthScreen} />
          <AuthStack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
          <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          <AuthStack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
          <AuthStack.Screen name="BioInput" component={BioInputScreen} />
          <AuthStack.Screen name="VerificationVideo" component={VerificationVideoScreen} />
          <AuthStack.Screen name="Tutorial" component={TutorialScreen} />
          <AuthStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          <AuthStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        </AuthStack.Navigator>
      ) : !isOnboarded ? (
        // Kullanıcı giriş yapmış ama profil tamamlanmamış - Onboarding
        <AuthStack.Navigator screenOptions={{ headerShown: false }} initialRouteName="ProfileSetup">
          <AuthStack.Screen name="Landing" component={LandingScreen} />
          <AuthStack.Screen name="EmailAuth" component={EmailAuthScreen} />
          <AuthStack.Screen name="PhoneVerification" component={PhoneVerificationScreen} />
          <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          <AuthStack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
          <AuthStack.Screen name="BioInput" component={BioInputScreen} />
          <AuthStack.Screen name="VerificationVideo" component={VerificationVideoScreen} />
          <AuthStack.Screen name="Tutorial" component={TutorialScreen} />
          <AuthStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
          <AuthStack.Screen name="TermsOfService" component={TermsOfServiceScreen} />
        </AuthStack.Navigator>
      ) : (
        // Kullanıcı giriş yapmış ve profil tamamlanmış - Ana uygulama
        <MainTabs />
      )}
    </NavigationContainer>
  );
}
