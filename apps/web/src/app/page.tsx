'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, LogOut } from 'lucide-react';
import { useSession, signOut } from '@/lib/auth-client';
import { SplashScreen } from '@/components/ui/splash-screen';
import { getIsInitialLoad, setIsInitialLoad } from '@/lib/initial-load';

export default function Home() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loading, setLoading] = useState(getIsInitialLoad());

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const initial = getIsInitialLoad();

    const loadData = async () => {
      const elapsed = Date.now() - startTime;
      if (initial && elapsed < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
      }
      if (initial) {
        setIsInitialLoad(false);
      }
      if (isMounted) setLoading(false);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <SplashScreen />;
  }

  const user = session?.user || {
    name: 'Tamas Varga',
    email: 'tamas@acmecorp.com',
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.refresh();
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] text-[#F0ECE5] flex flex-col font-sans selection:bg-[#E5A320] selection:text-[#0B0B0F]">
      {/* Top Navbar */}
      <header className="h-20 border-b border-[#1F1F26] px-8 flex items-center justify-between max-w-7xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#141418] border border-[#2A2A32] p-1.5 flex items-center justify-center shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/standlens-icon-512.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[#F0ECE5]">StandLens</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#9B9BA3]">
          <a href="#features" className="hover:text-[#F0ECE5] transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-[#F0ECE5] transition-colors">
            How it works
          </a>
          <a href="#teams" className="hover:text-[#F0ECE5] transition-colors">
            For Teams
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            <>
              <Link
                href="/login"
                className="text-sm font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] transition-colors px-3 py-2"
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-[#E5A320]/20 flex items-center gap-1.5"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/dashboard"
                className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-[#E5A320]/20 flex items-center gap-1.5"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Link>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-9 h-9 rounded-full bg-[#5B46F6] text-[#F0ECE5] font-semibold text-xs flex items-center justify-center cursor-pointer shadow-inner hover:opacity-90 transition-opacity"
                >
                  {getInitials(user.name || 'User')}
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />

                    <div className="absolute right-0 mt-2 w-56 bg-[#14141A]/95 backdrop-blur-md border border-[#23232C] rounded-[24px] shadow-2xl z-50 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center gap-3 border-b border-[#23232C] pb-3">
                        <div className="w-10 h-10 rounded-full bg-[#5B46F6] text-[#F0ECE5] font-bold text-sm flex items-center justify-center shrink-0 shadow-inner">
                          {getInitials(user.name || 'User')}
                        </div>
                        <div className="overflow-hidden text-left">
                          <h4 className="text-xs font-bold text-[#F0ECE5] truncate leading-tight">
                            {user.name || 'Developer'}
                          </h4>
                          <p className="text-[10px] text-[#9B9BA3] truncate leading-tight mt-1">
                            {user.email || 'user@standlens.com'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="w-full bg-[#F87171]/10 hover:bg-[#F87171] hover:text-[#0B0B0F] border border-[#F87171]/20 text-[#F87171] font-bold text-xs py-2 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Log Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-8 py-20 flex flex-col items-center text-center space-y-8">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E5A320]/10 border border-[#E5A320]/20 text-[#E5A320] text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> AI-Powered Async Standup Summarizer
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#F0ECE5] max-w-4xl leading-tight">
          Replace 15-minute standup meetings with <span className="text-[#E5A320]">30-second AI digests</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-base md:text-lg text-[#9B9BA3] max-w-2xl leading-relaxed">
          Developers post quick daily updates. StandLens uses AI to synthesize team progress, highlight major achievements, and flag active blockers automatically.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-base px-8 py-4 rounded-xl transition-all shadow-xl hover:shadow-[#E5A320]/25 flex items-center justify-center gap-2"
            >
              Go to Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="w-full sm:w-auto bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-base px-8 py-4 rounded-xl transition-all shadow-xl hover:shadow-[#E5A320]/25 flex items-center justify-center gap-2"
              >
                Get Started Free <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto bg-[#14141A] hover:bg-[#1C1C24] border border-[#23232C] text-[#F0ECE5] font-semibold text-base px-8 py-4 rounded-xl transition-all flex items-center justify-center"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Mock AI Digest Card Preview */}
        <div className="w-full max-w-3xl pt-10">
          <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 md:p-8 text-left space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#23232C] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#A855F7]/10 text-[#A855F7]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#F0ECE5]">AI Digest — Acme Engineering</h3>
                  <p className="text-xs text-[#9B9BA3]">Today · 5 standups summarized</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20">
                deepseek-r1
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-[#E5A320] uppercase tracking-wider block mb-1">
                  ⚡ Executive Summary
                </span>
                <p className="text-[#D1D1D6] leading-relaxed">
                  Sprint progress is steady. Auth refactor is ~60% complete. CI stability is being addressed by Jordan. Onboarding step 3 shipped to staging with full E2E coverage.
                </p>
              </div>

              <div>
                <span className="font-bold text-[#34D399] uppercase tracking-wider block mb-1">
                  ✓ Key Highlights
                </span>
                <ul className="text-[#D1D1D6] space-y-1">
                  <li>• Auth refactor token refresh edge case resolved by Marta</li>
                  <li>• Onboarding step 3 shipped to staging</li>
                </ul>
              </div>

              <div>
                <span className="font-bold text-[#F87171] uppercase tracking-wider block mb-1">
                  ⚠ Blockers & Risks
                </span>
                <p className="text-[#F87171] bg-[#F87171]/10 border border-[#F87171]/20 p-2.5 rounded-xl">
                  SendGrid test account access pending for Alex — email notifications delayed
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Ads Showcase Section */}
        <section id="features" className="w-full pt-32 space-y-24 text-left">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-[#F0ECE5] tracking-tight sm:text-4xl">
              Engineered for Modern Dev Workflows
            </h2>
            <p className="text-sm text-[#9B9BA3] leading-relaxed">
              Ditch the daily meeting fatigue. Streamline your team updates, tasks, and resources with our fully integrated HRMS task suite.
            </p>
          </div>

          {/* Feature Ad 1: AI Standups Digests */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 tracking-wider">
                Feature Spotlight
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-[#F0ECE5] leading-tight">
                AI Standup Summaries & Digests
              </h3>
              <p className="text-sm text-[#9B9BA3] leading-relaxed">
                Developers write quick, bulleted updates at their own convenience. Our advanced AI synthesizes these updates into high-level executive summaries, key highlights, and active blocker radars.
              </p>
              <ul className="space-y-3 text-xs text-[#D1D1D6]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Summarizes 10+ entries in 30 seconds
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Highlights active blockers in red alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Keeps the entire engineering team in sync asynchronously
                </li>
              </ul>
            </div>
            
            {/* Visual Preview Ad */}
            <div className="bg-[#14141A]/60 border border-[#23232C] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-[#383846] transition-colors">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#A855F7]/5 rounded-full blur-[50px] pointer-events-none" />
              <div className="flex items-center justify-between border-b border-[#23232C] pb-3 mb-4">
                <span className="text-[10px] font-bold text-[#A855F7] uppercase tracking-wider">AI Standup Digest</span>
                <span className="text-[9px] bg-[#A855F7]/10 text-[#A855F7] px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
              </div>
              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="font-bold text-[#E5A320] block mb-1">⚡ Executive Summary</span>
                  <p className="text-[#9B9BA3] leading-relaxed">Shipped dashboard upgrades and resolved team task progress indicators. Auto-delete cleanup intervals reduced to 30 days.</p>
                </div>
                <div>
                  <span className="font-bold text-[#F87171] block mb-1">⚠ 1 Critical Blocker</span>
                  <div className="bg-[#F87171]/5 border border-[#F87171]/20 p-2 rounded-xl text-[#F87171]">
                    API gateway CORS configurations blocking dev testing.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Ad 2: HRMS Project & Task Board */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 lg:order-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#5B46F6]/10 text-[#5B46F6] border border-[#5B46F6]/20 tracking-wider">
                HRMS Core
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-[#F0ECE5] leading-tight">
                HRMS-Style Project & Task Management
              </h3>
              <p className="text-sm text-[#9B9BA3] leading-relaxed">
                Empower your team leaders to create projects and build structured task lists. Team members can easily view assigned workloads, check off items, submit status updates, and track overall progress dynamically.
              </p>
              <ul className="space-y-3 text-xs text-[#D1D1D6]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Drag-and-drop Kanban task boards
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Interactive detail modals with nested subtask checklists
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Gated project controls restricted strictly to owners
                </li>
              </ul>
            </div>

            {/* Visual Preview Ad */}
            <div className="bg-[#14141A]/60 border border-[#23232C] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-[#383846] transition-colors space-y-4 lg:order-1">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#5B46F6]/5 rounded-full blur-[50px] pointer-events-none" />
              <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
                <span className="text-[10px] font-bold text-[#5B46F6] uppercase tracking-wider">Project Kanban Board</span>
                <span className="text-[9px] bg-[#5B46F6]/10 text-[#5B46F6] px-1.5 py-0.5 rounded font-bold uppercase">2 Active Projects</span>
              </div>
              <div className="bg-[#1C1C24] border border-[#2D2D37] rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-[#F0ECE5]">User Authentication Flow</h4>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 uppercase">High</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9px] text-[#71717A] font-semibold">
                    <span>4/6 Subtasks Done</span>
                    <span>66%</span>
                  </div>
                  <div className="h-1 w-full bg-[#14141A] rounded-full overflow-hidden">
                    <div className="h-full bg-[#E5A320] rounded-full" style={{ width: '66%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Ad 3: Smart Workload Load Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 tracking-wider">
                Workforce Health
              </span>
              <h3 className="text-2xl md:text-3xl font-black text-[#F0ECE5] leading-tight">
                Smart Workload Balancing & Member Load Alerts
              </h3>
              <p className="text-sm text-[#9B9BA3] leading-relaxed">
                Keep project delivery smooth and devs healthy. The system monitors outstanding workloads in real-time, warning team leaders of potential burnout by displaying smart load alerts (Safe, Warning, Critical) next to assignees.
              </p>
              <ul className="space-y-3 text-xs text-[#D1D1D6]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Dynamic live task-load indicators
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Color-coded active workload status badges
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5A320]" />
                  Helps managers balance tasks fairly across the team
                </li>
              </ul>
            </div>

            {/* Visual Preview Ad */}
            <div className="bg-[#14141A]/60 border border-[#23232C] rounded-2xl p-6 shadow-2xl relative overflow-hidden group hover:border-[#383846] transition-colors space-y-4">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-[#10B981]/5 rounded-full blur-[50px] pointer-events-none" />
              <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
                <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider">Assignee Load Gating</span>
                <span className="text-[9px] bg-[#10B981]/10 text-[#10B981] px-1.5 py-0.5 rounded font-bold uppercase">Active Balancing</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between bg-[#1C1C24] p-3 rounded-xl border border-[#2A2A32]/60">
                  <span className="text-xs font-semibold text-[#F0ECE5]">Marta Kovacs</span>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20 uppercase">3+ Active (Overload)</span>
                </div>
                <div className="flex items-center justify-between bg-[#1C1C24] p-3 rounded-xl border border-[#2A2A32]/60">
                  <span className="text-xs font-semibold text-[#F0ECE5]">Jordan Smith</span>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 uppercase">0 Active (Safe)</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1F1F26] py-8 text-center text-xs text-[#9B9BA3] space-y-2">
        <p>© 2026 StandLens. Built for modern engineering teams.</p>
        <p className="text-[10px]">
          Handcrafted with ❤️ by{' '}
          <a
            href="https://github.com/TamasruPain"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-[#E5A320] hover:text-[#F5B731] hover:underline transition-colors duration-200"
          >
            @TamasruPain
          </a>
        </p>
      </footer>
    </div>
  );
}
