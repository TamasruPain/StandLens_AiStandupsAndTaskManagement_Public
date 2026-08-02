'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Plus, Search, Crown, Users, X, Hourglass, Loader2, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { SplashScreen } from '@/components/ui/splash-screen';
import { getIsInitialLoad, setIsInitialLoad } from '@/lib/initial-load';

interface TeamsDataState {
  ownedTeams: Record<string, unknown>[];
  memberTeams: Record<string, unknown>[];
  incomingRequests: Record<string, unknown>[];
  sentRequests: Record<string, unknown>[];
}

export default function TeamsPage() {
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'your-teams' | 'search-teams'>('your-teams');
  const [loading, setLoading] = useState(getIsInitialLoad());

  // Live state
  const [teamsData, setTeamsData] = useState<TeamsDataState>({
    ownedTeams: [],
    memberTeams: [],
    incomingRequests: [],
    sentRequests: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Record<string, unknown>[]>([]);
  const [searching, setSearching] = useState(false);

  // Create Team modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newDiscoverable, setNewDiscoverable] = useState(true);
  const [creating, setCreating] = useState(false);

  // Join via Invite Code modal state
  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningWithCode, setJoiningWithCode] = useState(false);

  // Load user teams & pending requests
  const loadTeams = useCallback(async () => {
    try {
      const res = await apiClient.getUserTeams(activeUserId);
      setTeamsData(res as unknown as TeamsDataState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load teams';
      toast.error('Failed to load teams', msg);
    }
  }, [activeUserId, toast]);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const initial = getIsInitialLoad();

    apiClient.getUserTeams(activeUserId)
      .then((res) => {
        if (isMounted) setTeamsData(res as unknown as TeamsDataState);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load teams';
          toast.error('Failed to load teams', msg);
        }
      })
      .finally(async () => {
        const elapsed = Date.now() - startTime;
        if (initial && elapsed < 2000) {
          await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
        }
        if (initial) {
          setIsInitialLoad(false);
        }
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeUserId, toast]);

  // Listen to real-time notification events for instant list updates
  useEffect(() => {
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;

      if (
        payload.type === 'REQUEST_APPROVED' ||
        payload.type === 'REQUEST_DECLINED' ||
        payload.type === 'JOIN_REQUEST'
      ) {
        void loadTeams();
      }
    };

    window.addEventListener('notifications-sse', handleRealtimeUpdate);
    return () => {
      window.removeEventListener('notifications-sse', handleRealtimeUpdate);
    };
  }, [loadTeams]);

  // Handle Search
  useEffect(() => {
    let isCancelled = false;

    if (activeTab === 'search-teams' && searchQuery.trim().length > 0) {
      const timer = setTimeout(() => {
        setSearching(true);
        apiClient.searchTeams(activeUserId, searchQuery)
          .then((results) => {
            if (!isCancelled) setSearchResults(results);
          })
          .catch((err: unknown) => {
            if (!isCancelled) {
              const msg = err instanceof Error ? err.message : 'Search failed';
              toast.error('Search failed', msg);
            }
          })
          .finally(() => {
            if (!isCancelled) setSearching(false);
          });
      }, 300);

      return () => {
        isCancelled = true;
        clearTimeout(timer);
      };
    }
  }, [searchQuery, activeTab, activeUserId, toast]);

  // Create Team Submission
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      await apiClient.createTeam(activeUserId, {
        name: newTeamName,
        companyName: newCompanyName,
        discoverable: newDiscoverable,
      });

      toast.success('Team created successfully!', `Created ${newTeamName}`);
      setShowCreateModal(false);
      setNewTeamName('');
      setNewCompanyName('');
      void loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred';
      toast.error('Failed to create team', msg);
    } finally {
      setCreating(false);
    }
  };

  // Join via Invite Code Submission
  const handleJoinViaInviteCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = inviteCodeInput.trim();
    if (!code) return;

    try {
      setJoiningWithCode(true);
      await apiClient.joinViaInviteCode(activeUserId, code);
      toast.success('Successfully joined team!', `Joined team workspace.`);
      setShowJoinCodeModal(false);
      setInviteCodeInput('');
      void loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid invite code or team not found';
      toast.error('Failed to join team', msg);
    } finally {
      setJoiningWithCode(false);
    }
  };

  // Respond to Join Request
  const handleRespond = async (teamId: string, requestId: string, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      await apiClient.respondToJoinRequest(activeUserId, teamId, requestId, status);
      toast.info(status === 'ACCEPTED' ? 'Join request accepted!' : 'Join request declined');
      void loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      toast.error('Action failed', msg);
    }
  };

  // Send Join Request
  const handleSendJoinRequest = async (teamId: string) => {
    try {
      await apiClient.sendJoinRequest(activeUserId, teamId);
      toast.success('Join request sent!', 'Team owner has been notified.');
      if (searchQuery) {
        const results = await apiClient.searchTeams(activeUserId, searchQuery);
        setSearchResults(results);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send join request';
      toast.error('Failed to send join request', msg);
    }
  };

  if (loading) {
    return <SplashScreen message="Loading teams..." />;
  }

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header
          title="Teams"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowJoinCodeModal(true)}
                className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#F0ECE5] border border-[#23232C] font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-4 h-4 text-[#E5A320]" /> Join with Code
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Create Team
              </button>
            </div>
          }
        />

        <main className="p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-[#14141A] p-1.5 rounded-2xl border border-[#23232C] w-fit select-none">
            <button
              onClick={() => setActiveTab('your-teams')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer',
                activeTab === 'your-teams'
                  ? 'bg-[#E5A320] text-[#0B0B0F] shadow-md'
                  : 'text-[#9B9BA3] hover:text-[#F0ECE5]',
              )}
            >
              Your Teams
            </button>
            <button
              onClick={() => setActiveTab('search-teams')}
              className={cn(
                'px-5 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer',
                activeTab === 'search-teams'
                  ? 'bg-[#E5A320] text-[#0B0B0F] shadow-md'
                  : 'text-[#9B9BA3] hover:text-[#F0ECE5]',
              )}
            >
              Search Public Teams
            </button>
          </div>

            <>
              {/* YOUR TEAMS TAB */}
              {activeTab === 'your-teams' && (
                <div className="space-y-8">
                  {/* Incoming Join Requests (for Owners/Admins) */}
                  {teamsData.incomingRequests.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#F0ECE5]">Join Requests for Your Teams</h3>
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#E5A320]/10 text-[#E5A320]">
                          {teamsData.incomingRequests.length}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {teamsData.incomingRequests.map((req: Record<string, unknown>) => {
                          const requester = req.user as { name?: string; email?: string } | undefined;
                          const teamInfo = req.team as { name?: string } | undefined;
                          const reqName = requester?.name || requester?.email || 'Someone';

                          return (
                            <div
                              key={req.id as string}
                              className="bg-[#14141A] border border-[#23232C] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                                  <Users className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-[#F0ECE5]">
                                    {reqName} <span className="text-[#9B9BA3] font-normal">wants to join</span> {teamInfo?.name}
                                  </h4>
                                  <p className="text-xs text-[#9B9BA3] mt-0.5">
                                    {requester?.email} · Requested on {new Date(req.createdAt as string).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRespond(req.teamId as string, req.id as string, 'ACCEPTED')}
                                  className="bg-[#34D399] hover:bg-[#34D399]/80 text-[#0B0B0F] font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRespond(req.teamId as string, req.id as string, 'DECLINED')}
                                  className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#F87171] border border-[#F87171]/20 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Sent Join Requests (Read-only list for Senders) */}
                  {teamsData.sentRequests.length > 0 && (
                    <section className="space-y-4">
                      <h3 className="text-base font-bold text-[#F0ECE5]">Sent Join Requests (Pending Approval)</h3>
                      <div className="space-y-3">
                        {teamsData.sentRequests.map((req: Record<string, unknown>) => {
                          const teamInfo = req.team as { name?: string; companyName?: string } | undefined;
                          return (
                            <div
                              key={req.id as string}
                              className="bg-[#14141A] border border-[#23232C] rounded-2xl p-4 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                                  <Hourglass className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-[#F0ECE5]">
                                    You requested to join <span className="text-[#E5A320]">{teamInfo?.name || 'Team'}</span>
                                  </h4>
                                  <p className="text-xs text-[#9B9BA3]">
                                    {teamInfo?.companyName} · Sent on {new Date(req.createdAt as string).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>

                              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E5A320]/10 text-[#E5A320] border border-[#E5A320]/20 flex items-center gap-1.5">
                                Pending Approval
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Owned Teams */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#E5A320]" />
                      <h3 className="text-base font-bold text-[#F0ECE5]">Teams You Own ({teamsData.ownedTeams.length})</h3>
                    </div>

                    {teamsData.ownedTeams.length === 0 ? (
                      <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                        You don&apos;t own any teams yet. Click &quot;Create Team&quot; to start one!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {teamsData.ownedTeams.map((team: Record<string, unknown>) => {
                          const countObj = team._count as { members?: number; standups?: number } | undefined;
                          return (
                            <div
                              key={team.id as string}
                              className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#333342] transition-colors"
                            >
                              <div>
                                <div className="flex items-center justify-between">
                                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#E5A320]/10 text-[#E5A320] border border-[#E5A320]/20">
                                    Owner
                                  </span>
                                  <span className="text-xs text-[#9B9BA3]">
                                    Code: <strong className="text-[#E5A320] font-mono">{team.inviteCode as string}</strong>
                                  </span>
                                </div>
                                <h4 className="font-bold text-lg text-[#F0ECE5] mt-3">{team.name as string}</h4>
                                <p className="text-xs text-[#9B9BA3] mt-0.5">{team.companyName as string}</p>
                              </div>

                              <div className="pt-4 border-t border-[#23232C] flex items-center justify-between text-xs text-[#9B9BA3]">
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3.5 h-3.5" /> {countObj?.members || 1}
                                  </span>
                                </div>
                                <Link
                                  href={`/teams/${team.id as string}`}
                                  className="text-[#E5A320] font-bold hover:underline flex items-center gap-1"
                                >
                                  Manage <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Joined Teams */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#3B82F6]" />
                      <h3 className="text-base font-bold text-[#F0ECE5]">Teams You Joined ({teamsData.memberTeams.length})</h3>
                    </div>

                    {teamsData.memberTeams.length === 0 ? (
                      <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                        You haven&apos;t joined any existing teams yet. Use an invite code or search public teams!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {teamsData.memberTeams.map((team: Record<string, unknown>) => {
                          const countObj = team._count as { members?: number } | undefined;
                          return (
                            <div
                              key={team.id as string}
                              className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#333342] transition-colors"
                            >
                              <div>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">
                                  Member
                                </span>
                                <h4 className="font-bold text-lg text-[#F0ECE5] mt-3">{team.name as string}</h4>
                                <p className="text-xs text-[#9B9BA3] mt-0.5">{team.companyName as string}</p>
                              </div>

                              <div className="pt-4 border-t border-[#23232C] flex items-center justify-between text-xs text-[#9B9BA3]">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3.5 h-3.5" /> {countObj?.members || 1} members
                                </span>
                                <Link
                                  href={`/teams/${team.id as string}`}
                                  className="text-[#E5A320] font-bold hover:underline flex items-center gap-1"
                                >
                                  View <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* SEARCH PUBLIC TEAMS TAB */}
              {activeTab === 'search-teams' && (
                <div className="space-y-6">
                  {/* Search Input Box */}
                  <div className="relative">
                    <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-[#9B9BA3]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search public teams by name or company..."
                      className="w-full bg-[#14141A] border border-[#23232C] rounded-2xl pl-12 pr-4 py-4 text-sm text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320]"
                    />
                  </div>

                  {/* Guide Callout Box */}
                  <div className="bg-[#1C1C24] border border-[#23232C] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-[#F0ECE5] flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-[#E5A320]" /> Have a private team invite code?
                      </h4>
                      <p className="text-xs text-[#9B9BA3] mt-1">
                        If a team is private or you have an 8-character invite code, click &quot;Join with Code&quot; to join instantly!
                      </p>
                    </div>
                    <button
                      onClick={() => setShowJoinCodeModal(true)}
                      className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                    >
                      Enter Invite Code →
                    </button>
                  </div>

                  {searching ? (
                    <div className="flex items-center justify-center py-12 text-[#E5A320] gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Searching public teams...
                    </div>
                  ) : searchQuery.trim().length === 0 ? (
                    <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center text-[#9B9BA3] space-y-2">
                      <Search className="w-8 h-8 text-[#9B9BA3]/50 mx-auto" />
                      <p className="text-sm font-semibold">Type a team or company name above to find public teams</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center text-[#9B9BA3]">
                      No public discoverable teams found matching &quot;{searchQuery}&quot;
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {searchResults.map((team: Record<string, unknown>) => {
                        const isMember = team.isMember === true;
                        const hasPending = team.hasPendingRequest === true || team.isPending === true;
                        const count = (team.memberCount as number) || (team._count as { members?: number })?.members || 1;

                        return (
                          <div
                            key={team.id as string}
                            className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#333342] transition-colors"
                          >
                            <div>
                              <h4 className="font-bold text-lg text-[#F0ECE5]">{team.name as string}</h4>
                              <p className="text-xs text-[#9B9BA3] mt-0.5">{team.companyName as string}</p>
                            </div>

                            <div className="pt-4 border-t border-[#23232C] flex items-center justify-between">
                              <span className="text-xs text-[#9B9BA3] flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" /> {count} {count === 1 ? 'member' : 'members'}
                              </span>

                              {isMember ? (
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 flex items-center gap-1.5 opacity-80 cursor-not-allowed">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Already a Member
                                  </span>
                                  <Link
                                    href={`/teams/${team.id as string}`}
                                    className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#F0ECE5] font-bold text-xs px-3 py-1.5 rounded-xl border border-[#23232C] transition-all"
                                  >
                                    Go to Team →
                                  </Link>
                                </div>
                              ) : hasPending ? (
                                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[#E5A320]/10 text-[#E5A320] border border-[#E5A320]/20 flex items-center gap-1.5 opacity-80 cursor-not-allowed">
                                  <Hourglass className="w-3.5 h-3.5 animate-pulse" /> Request Pending
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSendJoinRequest(team.id as string)}
                                  className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                                >
                                  Request to Join
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
        </main>
      </div>

      {/* CREATE TEAM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#F0ECE5]">Create New Team Workspace</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Core Engineering"
                  className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                  Company / Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-semibold text-[#F0ECE5]">Public Discoverability</p>
                  <p className="text-[10px] text-[#9B9BA3]">Allow developers to request joining in public search</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNewDiscoverable(!newDiscoverable)}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                    newDiscoverable ? 'bg-[#E5A320]' : 'bg-[#2A2A35]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-[#0B0B0F] block transform transition-transform duration-200 ease-in-out ${
                      newDiscoverable ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#23232C]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#9B9BA3] font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN VIA INVITE CODE MODAL */}
      {showJoinCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 max-w-md w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#E5A320]" />
                <h3 className="font-bold text-lg text-[#F0ECE5]">Join Team with Invite Code</h3>
              </div>
              <button
                onClick={() => setShowJoinCodeModal(false)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleJoinViaInviteCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                  Invite Code or Team ID
                </label>
                <input
                  type="text"
                  required
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value)}
                  placeholder="e.g. ACME-DEV-123 or cms3fnim3000..."
                  className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm font-mono text-[#E5A320] placeholder-[#9B9BA3]/40 focus:outline-none focus:border-[#E5A320]"
                />
                <p className="text-[10px] text-[#9B9BA3] mt-1.5">
                  Enter your team&apos;s workspace invite code or team ID to join instantly.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#23232C]">
                <button
                  type="button"
                  onClick={() => setShowJoinCodeModal(false)}
                  className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#9B9BA3] font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joiningWithCode}
                  className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {joiningWithCode ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
