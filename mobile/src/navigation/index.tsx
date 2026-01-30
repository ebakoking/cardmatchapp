import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import PhoneVerificationScreen from '../screens/Onboarding/PhoneVerificationScreen';
import ProfileSetupScreen from '../screens/Onboarding/ProfileSetupScreen';
import PhotoUploadScreen from '../screens/Onboarding/PhotoUploadScreen';
import BioInputScreen from '../screens/Onboarding/BioInputScreen';
import VerificationVideoScreen from '../screens/Onboarding/VerificationVideoScreen';
import TutorialScreen from '../screens/Onboarding/TutorialScreen';
import AvatarSelectionScreen from '../screens/Onboarding/AvatarSelectionScreen';
import SocialAuthScreen from '../screens/Onboarding/SocialAuthScreen';
import HomeScreen from '../screens/Home/HomeScreen';
import MatchQueueScreen from '../screens/Match/MatchQueueScreen';
import CardGateScreen from '../screens/Match/CardGateScreen';
import MatchSettingsScreen from '../screens/Match/MatchSettingsScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import FriendsScreen from '../screens/Friends/FriendsScreen';
import FriendChatScreen from '../screens/Friends/FriendChatScreen';
import FriendProfileScreen from '../screens/Friends/FriendProfileScreen';
import FriendCallScreen from '../screens/Friends/FriendCallScreen';
import LeaderboardScreen from '../screens/Leaderboard/LeaderboardScreen';
import SubscriptionScreen from '../screens/Subscription/SubscriptionScreen';
import TokenPurchaseScreen from '../screens/Subscription/TokenPurchaseScreen';

export type AuthStackParamList = {
  SocialAuth: undefined;
  PhoneVerification: undefined;
  ProfileSetup: undefined;
  PhotoUpload: undefined;
  BioInput: undefined;
  VerificationVideo: undefined;
  Tutorial: undefined;
};

export type ChatStackParamList = {
  HomeMain: undefined;
  MatchQueue: undefined;
  MatchSettings: undefined;
  CardGate: { matchId: string };
  Chat: { sessionId: string; partnerNickname: string; partnerId: string };
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
    friendOnline: boolean;
    friendId: string;
  };
  FriendProfile: {
    friendId: string;
    friendNickname: string;
  };
  FriendCall: {
    friendshipId: string;
    friendNickname: string;
    friendPhoto?: string;
    friendId: string;
    callType: 'voice' | 'video';
    isIncoming: boolean;
  };
};

export type SubscriptionStackParamList = {
  Subscription: undefined;
  TokenPurchase: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  AvatarSelection: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();
const SubscriptionStack = createNativeStackNavigator<SubscriptionStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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
      <FriendsStack.Screen name="FriendCall" component={FriendCallScreen} />
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
    </ProfileStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={ChatStackNavigator} />
      <Tab.Screen name="Friends" component={FriendsStackNavigator} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading, onboardingCompleted } = useAuth();

  if (loading) return null;

  // Kullanıcının gerçekten profil oluşturup oluşturmadığını kontrol et
  const hasDefaultNickname = user?.nickname?.startsWith('user_') || 
                              user?.nickname?.startsWith('apple_user_') || 
                              user?.nickname?.startsWith('google_user_') ||
                              user?.nickname?.startsWith('apple_');
  
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

  // ÖNEMLİ: Eğer kullanıcı tutorial'ı bitirdiyse (onboardingCompleted = true),
  // profil kontrolünü bypass et. Tutorial'a kadar geldiyse profil zaten doldurulmuştur.
  // Bu, refreshProfile'ın gecikmeli çalışması durumunda bile uygulamaya geçişi sağlar.
  const isOnboarded = onboardingCompleted || hasCompletedProfile;
  
  console.log('[Navigation] isOnboarded:', isOnboarded, 'hasCompletedProfile:', hasCompletedProfile, 'onboardingCompleted:', onboardingCompleted, 'user:', user?.nickname);

  return (
    <NavigationContainer>
      {!user || !isOnboarded ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SocialAuth" component={SocialAuthScreen} />
          <AuthStack.Screen
            name="PhoneVerification"
            component={PhoneVerificationScreen}
          />
          <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          <AuthStack.Screen name="PhotoUpload" component={PhotoUploadScreen} />
          <AuthStack.Screen name="BioInput" component={BioInputScreen} />
          <AuthStack.Screen
            name="VerificationVideo"
            component={VerificationVideoScreen}
          />
          <AuthStack.Screen name="Tutorial" component={TutorialScreen} />
        </AuthStack.Navigator>
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}

