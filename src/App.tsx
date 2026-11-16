import { useState } from 'react';
import { AppShell, type AppTab } from './components/AppShell';
import { CookieConsentFlash, CookieConsentProvider } from './components/CookieConsentFlash';
import { DiscoverView } from './components/DiscoverView';
import { DoodleSquirrel } from './components/DoodleSquirrel';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  IdentityVerificationModal,
  type VerificationTab,
} from './components/IdentityVerificationModal';
import { MatchCelebrationModal } from './components/MatchCelebrationModal';
import { MatchesChatView } from './components/MatchesChatView';
import { NearMatchLogo } from './components/NearMatchLogo';
import { OnboardingFlow } from './components/OnboardingFlow';
import { ProfileSettingsView, type ProfileSection } from './components/ProfileSettingsView';
import { SignInScreen } from './components/SignInScreen';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useNearMatchData } from './hooks/useNearMatchData';
import { getVerificationStatus } from './lib/identityVerification';
import type { UnifiedConversation } from './types/models';

function NearMatchWorkspace() {
  const {
    user,
    authReady,
    profile,
    privateAccount,
    profileLoading,
    authError,
    signInWithGoogle,
    signOut,
    clearAuthError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AppTab>('discover');
  const [profileSection, setProfileSection] = useState<ProfileSection>('about');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [celebratingMatch, setCelebratingMatch] = useState<UnifiedConversation | null>(null);
  const [verificationModalTab, setVerificationModalTab] = useState<VerificationTab | null>(null);

  const data = useNearMatchData(profile, privateAccount);

  if (!authReady || (user && profileLoading)) {
    return (
      <>
        <div className="min-h-screen bg-[#FFF8EC] flex items-center justify-center p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <NearMatchLogo height={128} showWordmark={false} />
            </div>
            <p className="text-sm font-semibold text-[#7A5234]">Connecting to NearMatch...</p>
          </div>
        </div>
        <CookieConsentFlash />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SignInScreen
          onSignIn={() => void signInWithGoogle()}
          authError={authError}
          onDismissError={clearAuthError}
        />
        <DoodleSquirrel />
        <CookieConsentFlash />
      </>
    );
  }

  if (profile?.isBanned || profile?.isDeleted) {
    return (
      <>
        <div className="min-h-screen bg-[#FFF8EC] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#F5C4A8] rounded-3xl p-8 text-center space-y-4 shadow-md">
            <h1 className="text-2xl font-bold text-[#3D2817]">
              {profile.isBanned ? 'Account suspended' : 'Account deactivated'}
            </h1>
            <p className="text-sm text-[#7A5234]">
              {profile.isBanned
                ? 'This account is currently suspended from NearMatch discovery.'
                : 'This NearMatch profile has been deactivated and its private data removed.'}
            </p>
            <button
              type="button"
              onClick={() => void signOut()}
              className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-[#E8603A] hover:bg-[#C44C29] text-white text-sm font-bold cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
        <CookieConsentFlash />
      </>
    );
  }

  if (!profile || !privateAccount || !profile.isOnboarded) {
    return (
      <>
        <OnboardingFlow user={user} onSignOut={() => void signOut()} />
        <DoodleSquirrel />
        <CookieConsentFlash />
      </>
    );
  }

  const verificationStatus = getVerificationStatus(profile, privateAccount);

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        totalUnread={data.totalUnread}
        maxDistanceKm={privateAccount.maxDistanceKm}
        isVisible={profile.isVisible}
        onQuickOpenFilters={() => {
          setProfileSection('preferences');
          setActiveTab('profile');
        }}
        onSignOut={() => void signOut()}
      >
        {data.dataError ? (
          <div className="mb-5 bg-[#FEECEB] border border-[#F5C2C0] rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#C0392B] break-all">{data.dataError}</p>
            <button
              type="button"
              onClick={data.clearDataError}
              className="text-xs font-bold text-[#C0392B] underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {activeTab === 'discover' ? (
          <DiscoverView
            viewer={profile}
            privateAccount={privateAccount}
            rankedCandidates={data.rankedCandidates}
            dailyMutualPick={data.dailyMutualPick}
            curatedHighlights={data.curatedHighlights}
            replyNeededCount={data.replyNeededCount}
            swipes={data.swipes}
            allCandidateProfiles={data.allCandidateProfiles}
            conversations={data.conversations}
            existingLiveMatchIds={data.existingLiveMatchIds}
            onMatchCreated={(conv) => setCelebratingMatch(conv)}
            onOpenChat={(conversationId) => {
              setSelectedConversationId(conversationId);
              setActiveTab('matches');
            }}
            onOpenReplies={() => setActiveTab('matches')}
            onOpenPreferences={() => {
              setProfileSection('preferences');
              setActiveTab('profile');
            }}
          />
        ) : null}

        {activeTab === 'matches' ? (
          <MatchesChatView
            viewer={profile}
            privateAccount={privateAccount}
            conversations={data.conversations}
            demoMatches={data.demoMatches}
            swipes={data.swipes}
            allCandidateProfiles={data.allCandidateProfiles}
            firstMatchId={data.firstMatchId}
            safetyCheckNowMs={data.safetyCheckNowMs}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            onMarkConversationSeenLocally={data.markConversationSeenLocally}
            onOpenVerification={(tab) => setVerificationModalTab(tab)}
            onDiscoverClick={() => setActiveTab('discover')}
          />
        ) : null}

        {activeTab === 'profile' ? (
          <ProfileSettingsView
            profile={profile}
            privateAccount={privateAccount}
            blocks={data.blocks}
            initialSection={profileSection}
            onSectionChange={setProfileSection}
            onOpenVerification={(tab) => setVerificationModalTab(tab)}
            onSignOut={() => void signOut()}
          />
        ) : null}

        {celebratingMatch ? (
          <MatchCelebrationModal
            conversation={celebratingMatch}
            viewerPhoto={profile.photos[0] ?? ''}
            viewerName={profile.displayName}
            verificationStatus={verificationStatus}
            onMessageNow={(conv) => {
              setCelebratingMatch(null);
              setSelectedConversationId(conv.id);
              setActiveTab('matches');
            }}
            onOpenVerification={(tab) => setVerificationModalTab(tab)}
            onKeepSwiping={() => setCelebratingMatch(null)}
          />
        ) : null}

        {verificationModalTab ? (
          <IdentityVerificationModal
            profile={profile}
            privateAccount={privateAccount}
            initialTab={verificationModalTab}
            onClose={() => setVerificationModalTab(null)}
          />
        ) : null}
      </AppShell>
      <DoodleSquirrel hasBottomNav />
      <CookieConsentFlash hasBottomNav />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CookieConsentProvider>
        <AuthProvider>
          <NearMatchWorkspace />
        </AuthProvider>
      </CookieConsentProvider>
    </ErrorBoundary>
  );
}
