import React from 'react';
import { Compass, HeartHandshake, LogOut, SlidersHorizontal, UserRound } from 'lucide-react';
import { NearMatchLogo } from './NearMatchLogo';

export type AppTab = 'discover' | 'matches' | 'profile';

interface AppShellProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  totalUnread: number;
  maxDistanceKm: number;
  isVisible: boolean;
  onQuickOpenFilters: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function AppShell({
  activeTab,
  onChangeTab,
  totalUnread,
  maxDistanceKm,
  isVisible,
  onQuickOpenFilters,
  onSignOut,
  children,
}: AppShellProps) {
  const navItems: {
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'matches', label: 'Matches', icon: HeartHandshake, badge: totalUnread },
    { id: 'profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="min-h-screen bg-[#FFF8EC] text-[#3D2817] flex flex-col">
      {/* Desktop 3-Zone Top Bar & Mobile Compact Header */}
      <header className="sticky top-0 z-30 bg-[#FFF8EC]/92 backdrop-blur-md border-b border-[#F5C4A8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 lg:h-16 flex items-center justify-between gap-2 sm:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => onChangeTab('discover')}
            className="focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
          >
            <NearMatchLogo height={36} wordmarkClassName="text-xl sm:text-2xl text-[#E8603A]" />
          </button>

          {/* Zone 2: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#E8603A] text-white shadow-sm'
                      : 'text-[#7A5234] hover:text-[#E8603A] hover:bg-[#FDE4D8]/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`ml-0.5 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-mono font-bold flex items-center justify-center ${
                        isActive ? 'bg-white text-[#C44C29]' : 'bg-[#E8603A] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Radius Filter & Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onQuickOpenFilters}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#A9D7C8] bg-[#DCF0EA] hover:bg-[#CBE8DF] text-xs font-bold text-[#2E6B5C] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Open discovery preferences"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">{maxDistanceKm} km</span>
              <span aria-hidden="true">·</span>
              <span>{isVisible ? 'Visible' : 'Paused'}</span>
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-transparent hover:border-[#F5C4A8] hover:bg-white text-xs font-bold text-[#7A5234] hover:text-[#C44C29] flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-8 pb-24 lg:pb-10">
        {children}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation (44px+ hit targets) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#F5C4A8] px-4 py-1.5"
        aria-label="Mobile navigation"
      >
        <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-colors cursor-pointer relative ${
                  isActive ? 'text-[#E8603A] bg-[#FDE4D8]/65' : 'text-[#7A5234]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#E8603A] text-white text-[10px] font-mono flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
