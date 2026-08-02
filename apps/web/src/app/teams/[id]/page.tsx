'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  Copy,
  Sparkles,
  Settings as SettingsIcon,
  CheckCircle2,
  AlertTriangle,
  ClipboardCheck,
  Loader2,
  Eye,
  Shield,
  Trash2,
  Save,
  Calendar,
  Filter,
  UserMinus,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';

type TabType = 'standups' | 'digest' | 'members' | 'settings';

interface StandupsDataState {
  standups: Record<string, unknown>[];
  myStandup: Record<string, unknown> | null;
  hasSubmitted: boolean;
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params?.id as string;
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('standups');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Date Filter State for Standups & Digests
  const [standupDateMode, setStandupDateMode] = useState<'TODAY' | 'YESTERDAY' | 'ALL' | 'CUSTOM'>('TODAY');
  const [customStandupDate, setCustomStandupDate] = useState('');

  const [digestDateMode, setDigestDateMode] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM'>('ALL');
  const [customDigestDate, setCustomDigestDate] = useState('');

  // Confirm Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveSettingsModal, setShowSaveSettingsModal] = useState(false);
  const [pendingDiscoverableToggle, setPendingDiscoverableToggle] = useState<boolean | null>(null);

  // Member Management Modals State
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{ memberUserId: string; userName: string } | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{ memberUserId: string; userName: string; targetRole: 'ADMIN' | 'MEMBER' } | null>(null);

  // Live state
  const [team, setTeam] = useState<Record<string, unknown> | null>(null);
  const [standupsData, setStandupsData] = useState<StandupsDataState>({ standups: [], myStandup: null, hasSubmitted: false });
  const [digests, setDigests] = useState<Record<string, unknown>[]>([]);

  // Standup Form state
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Team Settings State
  const [settingsName, setSettingsName] = useState('');
  const [settingsCompany, setSettingsCompany] = useState('');
  const [settingsDiscoverable, setSettingsDiscoverable] = useState(true);
  const [settingsVisibility, setSettingsVisibility] = useState('EVERYONE');
  const [settingsTriggerPermission, setSettingsTriggerPermission] = useState('ALL_MEMBERS');
  const [savingSettings, setSavingSettings] = useState(false);

  // Load Team Details & Standups
  const loadTeamData = useCallback(async () => {
    if (!teamId) return;
    try {
      const [teamRes, standupsRes, digestsRes] = await Promise.all([
        apiClient.getTeamDetails(activeUserId, teamId),
        apiClient.getTeamStandups(activeUserId, teamId).catch(() => ({ standups: [], myStandup: null, hasSubmitted: false })),
        apiClient.getTeamDigests(activeUserId, teamId).catch(() => []),
      ]);

      if (!teamRes) {
        toast.error('Access denied', 'You are not a member of this team.');
        window.location.href = '/teams?tab=search-teams';
        return;
      }

      setTeam(teamRes as Record<string, unknown> | null);
      setStandupsData(standupsRes as unknown as StandupsDataState);
      setDigests(digestsRes as Record<string, unknown>[]);

      setSettingsName((teamRes.name as string) || '');
      setSettingsCompany((teamRes.companyName as string) || '');
      setSettingsDiscoverable(teamRes.discoverable === true);
      setSettingsVisibility((teamRes.digestVisibility as string) || 'EVERYONE');
      setSettingsTriggerPermission((teamRes.digestTriggerPermission as string) || 'ALL_MEMBERS');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading team details';
      toast.error('Access denied', msg);
      window.location.href = '/teams?tab=search-teams';
    }
  }, [teamId, activeUserId, toast]);

  useEffect(() => {
    let isMounted = true;
    if (!teamId) return;

    Promise.all([
      apiClient.getTeamDetails(activeUserId, teamId),
      apiClient.getTeamStandups(activeUserId, teamId).catch(() => ({ standups: [], myStandup: null, hasSubmitted: false })),
      apiClient.getTeamDigests(activeUserId, teamId).catch(() => []),
    ]).then(([teamRes, standupsRes, digestsRes]) => {
      if (!isMounted) return;
      if (!teamRes) {
        toast.error('Access denied', 'You are not a member of this team.');
        window.location.href = '/teams?tab=search-teams';
        return;
      }
      setTeam(teamRes as Record<string, unknown> | null);
      setStandupsData(standupsRes as unknown as StandupsDataState);
      setDigests(digestsRes as Record<string, unknown>[]);

      setSettingsName((teamRes.name as string) || '');
      setSettingsCompany((teamRes.companyName as string) || '');
      setSettingsDiscoverable(teamRes.discoverable === true);
      setSettingsVisibility((teamRes.digestVisibility as string) || 'EVERYONE');
      setSettingsTriggerPermission((teamRes.digestTriggerPermission as string) || 'ALL_MEMBERS');
    }).catch((err: unknown) => {
      if (!isMounted) return;
      const msg = err instanceof Error ? err.message : 'You are not a member of this team.';
      toast.error('Access denied', msg);
      window.location.href = '/teams?tab=search-teams';
    }).finally(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [teamId, activeUserId, toast]);

  // Listen to real-time standup updates and list modifications in real-time
  useEffect(() => {
    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;
      if (payload.type === 'MEMBER_REMOVED' && payload.teamId === teamId) {
        window.location.href = '/teams?tab=search-teams';
        return;
      }

      if (payload.type === 'ROLE_UPDATED' && payload.teamId === teamId) {
        setTeam((prevTeam) => {
          if (!prevTeam) return prevTeam;

          const members = (prevTeam.members as Record<string, unknown>[] || []).map((m) => {
            const userObj = m.user as { id: string } | undefined;
            const mUserId = m.userId || userObj?.id;
            if (mUserId === payload.userId) {
              return { ...m, role: payload.role };
            }
            return m;
          });

          const isMe = payload.userId === activeUserId;

          return {
            ...prevTeam,
            members,
            myRole: isMe ? payload.role : prevTeam.myRole,
          };
        });
        return;
      }

      if (payload.type === 'STANDUP_SUBMITTED' && payload.teamId === teamId) {
        const newStandup = payload.standup;

        setStandupsData((prev) => {
          const exists = prev.standups.some((s) => s.id === newStandup.id);
          const updatedStandups = exists
            ? prev.standups.map((s) => (s.id === newStandup.id ? newStandup : s))
            : [newStandup, ...prev.standups];

          const isMyStandup = newStandup.userId === activeUserId;

          return {
            ...prev,
            standups: updatedStandups,
            myStandup: isMyStandup ? newStandup : prev.myStandup,
            hasSubmitted: isMyStandup ? true : prev.hasSubmitted,
          };
        });
      }
    };

    window.addEventListener('notifications-sse', handleRealtimeUpdate);
    return () => {
      window.removeEventListener('notifications-sse', handleRealtimeUpdate);
    };
  }, [teamId, activeUserId]);

  // Date Filter Handlers for Standups
  const handleStandupDateFilterChange = async (mode: 'TODAY' | 'YESTERDAY' | 'ALL' | 'CUSTOM', customDate?: string) => {
    setStandupDateMode(mode);
    let dateStrParam: string | undefined = undefined;

    if (mode === 'TODAY') {
      dateStrParam = new Date().toISOString().split('T')[0];
    } else if (mode === 'YESTERDAY') {
      const y = new Date(Date.now() - 86400000);
      dateStrParam = y.toISOString().split('T')[0];
    } else if (mode === 'ALL') {
      dateStrParam = 'ALL';
    } else if (mode === 'CUSTOM' && customDate) {
      dateStrParam = customDate;
    }

    try {
      const res = await apiClient.getTeamStandups(activeUserId, teamId, dateStrParam);
      setStandupsData(res as unknown as StandupsDataState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to filter standups';
      toast.error('Filter failed', msg);
    }
  };

  // Date Filter Handlers for Digests
  const handleDigestDateFilterChange = async (mode: 'ALL' | 'TODAY' | 'YESTERDAY' | 'CUSTOM', customDate?: string) => {
    setDigestDateMode(mode);
    let dateStrParam: string | undefined = undefined;

    if (mode === 'TODAY') {
      dateStrParam = new Date().toISOString().split('T')[0];
    } else if (mode === 'YESTERDAY') {
      const y = new Date(Date.now() - 86400000);
      dateStrParam = y.toISOString().split('T')[0];
    } else if (mode === 'ALL') {
      dateStrParam = 'ALL';
    } else if (mode === 'CUSTOM' && customDate) {
      dateStrParam = customDate;
    }

    try {
      const res = await apiClient.getTeamDigests(activeUserId, teamId, dateStrParam);
      setDigests(res as Record<string, unknown>[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to filter digests';
      toast.error('Filter failed', msg);
    }
  };

  const copyInviteCode = () => {
    const inviteCode = team?.inviteCode as string | undefined;
    if (inviteCode) {
      void navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Invite code copied!', inviteCode);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Submit Standup Handler
  const handleStandupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await apiClient.submitStandup(activeUserId, {
        teamId,
        yesterday,
        today,
        blockers,
      });

      toast.success('Standup submitted successfully!', 'Your team can now view your update.');
      setYesterday('');
      setToday('');
      setBlockers('');
      void loadTeamData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting standup';
      toast.error('Failed to submit standup', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger AI Digest Generation
  const handleGenerateDigest = async () => {
    try {
      setIsGenerating(true);
      toast.info('Synthesizing standups...', 'OpenRouter AI is generating executive digest.');
      await apiClient.triggerDigestGeneration(activeUserId, teamId);
      await loadTeamData();
      toast.success('AI Digest generated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error generating digest';
      toast.error('Failed to generate digest', msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Team Settings Handler
  const executeSaveTeamSettings = async () => {
    try {
      setSavingSettings(true);
      const updatedTeam = await apiClient.updateTeam(activeUserId, teamId, {
        name: settingsName,
        companyName: settingsCompany,
        discoverable: settingsDiscoverable,
        digestVisibility: settingsVisibility,
        digestTriggerPermission: settingsTriggerPermission,
      });

      setTeam(updatedTeam as Record<string, unknown>);
      setSettingsDiscoverable(updatedTeam.discoverable === true);
      toast.success('Team settings saved!', 'Updated settings in database.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving settings';
      toast.error('Failed to save settings', msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveTeamSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSaveSettingsModal(true);
  };

  // Delete Team Handler
  const handleDeleteTeam = async () => {
    try {
      await apiClient.deleteTeam(activeUserId, teamId);
      toast.success('Team deleted successfully');
      window.location.href = '/teams';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting team';
      toast.error('Failed to delete team', msg);
    }
  };

  // Remove Member Execution
  const executeRemoveMember = async () => {
    if (!pendingRemoveMember) return;
    try {
      await apiClient.removeMember(activeUserId, teamId, pendingRemoveMember.memberUserId);
      toast.success('Member removed!', `Successfully removed ${pendingRemoveMember.userName} from team.`);
      setPendingRemoveMember(null);
      void loadTeamData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove member';
      toast.error('Action failed', msg);
    }
  };

  // Change Role Execution
  const executeRoleChange = async () => {
    if (!pendingRoleChange) return;
    try {
      await apiClient.changeMemberRole(activeUserId, teamId, pendingRoleChange.memberUserId, pendingRoleChange.targetRole);
      toast.success('Role updated!', `Updated ${pendingRoleChange.userName} to ${pendingRoleChange.targetRole}.`);
      setPendingRoleChange(null);
      void loadTeamData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change member role';
      toast.error('Action failed', msg);
    }
  };

  const teamNameStr = (team?.name as string) || 'Team Workspace';
  const companyNameStr = (team?.companyName as string) || '';
  const teamCountObj = team?._count as { members?: number } | undefined;
  const teamMembersArr = (team?.members as Record<string, unknown>[]) || [];
  const myRoleStr = (team?.myRole as string) || 'MEMBER';

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title={teamNameStr} backUrl="/teams" backLabel="Teams" />

        <main className="p-8 space-y-8 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-[#E5A320] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /> Loading team details...
            </div>
          ) : (
            <>
              {/* Team Info Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14141A] border border-[#23232C] rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#E5A320] text-[#0B0B0F] flex items-center justify-center font-bold text-xl shadow-md">
                    <SettingsIcon className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#F0ECE5]">{teamNameStr}</h2>
                    <p className="text-xs text-[#9B9BA3] mt-0.5">
                      {companyNameStr} · {teamCountObj?.members || 1} members · <span className="text-[#E5A320] font-bold">{myRoleStr}</span>
                    </p>
                  </div>
                </div>

                {/* Invite Code Box */}
                {!!team?.inviteCode && (
                  <button
                    onClick={copyInviteCode}
                    className="bg-[#1C1C24] hover:bg-[#2A2A35] border border-[#2A2A35] rounded-xl px-4 py-2.5 flex items-center gap-3 text-xs text-[#9B9BA3] transition-colors cursor-pointer self-start md:self-auto"
                  >
                    <span>
                      Invite Code: <strong className="text-[#E5A320]">{team.inviteCode as string}</strong>
                    </span>
                    <Copy className="w-3.5 h-3.5" />
                    {copied && <span className="text-[#34D399] font-bold">Copied!</span>}
                  </button>
                )}
              </div>

              {/* Sub-Tabs */}
              <div className="flex items-center gap-6 border-b border-[#1F1F26] pb-1 select-none">
                {(['standups', 'digest', 'members', 'settings'] as TabType[])
                  .filter((tab) => tab !== 'settings' || myRoleStr !== 'MEMBER')
                  .map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'pb-3 text-sm font-bold capitalize transition-all cursor-pointer relative',
                      activeTab === tab
                        ? 'text-[#E5A320]'
                        : 'text-[#9B9BA3] hover:text-[#F0ECE5]',
                    )}
                  >
                    {tab}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E5A320] rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              {/* STANDUPS TAB */}
              {activeTab === 'standups' && (
                <div className="space-y-6">
                  {/* Standup Day-to-Day Filter Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#14141A] border border-[#23232C] rounded-2xl p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Filter className="w-4 h-4 text-[#E5A320]" />
                      <span className="text-xs font-bold text-[#F0ECE5] mr-1">Filter Date:</span>
                      <button
                        type="button"
                        onClick={() => void handleStandupDateFilterChange('TODAY')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          standupDateMode === 'TODAY'
                            ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStandupDateFilterChange('YESTERDAY')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          standupDateMode === 'YESTERDAY'
                            ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        Yesterday
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStandupDateFilterChange('ALL')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          standupDateMode === 'ALL'
                            ? 'bg-[#E5A320] text-[#0B0B0F] shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        All History
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#9B9BA3]" />
                      <span className="text-xs text-[#9B9BA3]">Custom Date:</span>
                      <input
                        type="date"
                        value={customStandupDate}
                        onChange={(e) => {
                          setCustomStandupDate(e.target.value);
                          if (e.target.value) {
                            void handleStandupDateFilterChange('CUSTOM', e.target.value);
                          }
                        }}
                        className="bg-[#1C1C24] border border-[#23232C] rounded-xl px-3 py-1.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                      />
                    </div>
                  </div>

                  {/* Submit Standup Form Card */}
                  {!standupsData.hasSubmitted ? (
                    <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-5 h-5 text-[#E5A320]" />
                        <div>
                          <h3 className="font-bold text-base text-[#F0ECE5]">Submit Your Standup</h3>
                          <p className="text-xs text-[#9B9BA3]">You haven&apos;t submitted today yet</p>
                        </div>
                      </div>

                      <form onSubmit={handleStandupSubmit} className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                            Yesterday
                          </label>
                          <textarea
                            required
                            rows={2}
                            value={yesterday}
                            onChange={(e) => setYesterday(e.target.value)}
                            placeholder="What did you accomplish yesterday?"
                            className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl p-3 text-xs text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                            Today
                          </label>
                          <textarea
                            required
                            rows={2}
                            value={today}
                            onChange={(e) => setToday(e.target.value)}
                            placeholder="What are you working on today?"
                            className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl p-3 text-xs text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1">
                            Blockers
                          </label>
                          <textarea
                            rows={2}
                            value={blockers}
                            onChange={(e) => setBlockers(e.target.value)}
                            placeholder="Any blockers? Leave empty if none."
                            className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl p-3 text-xs text-[#F0ECE5] placeholder-[#9B9BA3]/50 focus:outline-none focus:border-[#E5A320]"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={submitting}
                            className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
                          >
                            {submitting ? 'Submitting...' : 'Submit Standup'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div className="bg-[#34D399]/10 border border-[#34D399]/20 rounded-2xl p-4 text-[#34D399] text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Standup submitted for today!
                    </div>
                  )}

                  {/* Developer Standup Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {standupsData.standups.length === 0 ? (
                      <div className="col-span-2 bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                        No team standups found for the selected date filter.
                      </div>
                    ) : (
                      standupsData.standups.map((s: Record<string, unknown>) => {
                        const userObj = s.user as { name?: string; email?: string } | undefined;
                        const userNameStr = userObj?.name || userObj?.email || 'User';

                        return (
                          <div key={s.id as string} className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center bg-[#8B5CF6]">
                                  {userNameStr.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-[#F0ECE5]">{userNameStr}</h4>
                                  <p className="text-xs text-[#9B9BA3]">
                                    {new Date(s.createdAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>

                              <span className="text-[10px] font-bold text-[#E5A320] bg-[#E5A320]/10 px-2 py-1 rounded-md border border-[#E5A320]/20">
                                {new Date(s.standupDate as string).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="space-y-3 text-xs">
                              <div>
                                <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                                  Yesterday
                                </span>
                                <p className="text-[#D1D1D6] leading-relaxed bg-[#1C1C24] p-3 rounded-xl">
                                  {s.yesterday as string}
                                </p>
                              </div>

                              <div>
                                <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                                  Today
                                </span>
                                <p className="text-[#D1D1D6] leading-relaxed bg-[#1C1C24] p-3 rounded-xl">
                                  {s.today as string}
                                </p>
                              </div>

                              <div>
                                <span className="font-semibold text-[#9B9BA3] uppercase tracking-wider block text-[10px] mb-1">
                                  Blockers
                                </span>
                                {s.blockers ? (
                                  <p className="text-[#F87171] leading-relaxed bg-[#F87171]/10 border border-[#F87171]/20 p-3 rounded-xl">
                                    {s.blockers as string}
                                  </p>
                                ) : (
                                  <p className="text-[#9B9BA3] bg-[#1C1C24] p-3 rounded-xl">None</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* DIGEST TAB */}
              {activeTab === 'digest' && (
                <div className="space-y-6">
                  {/* Digest Day-to-Day Filter Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#14141A] border border-[#23232C] rounded-2xl p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Filter className="w-4 h-4 text-[#A855F7]" />
                      <span className="text-xs font-bold text-[#F0ECE5] mr-1">Filter Digests:</span>
                      <button
                        type="button"
                        onClick={() => void handleDigestDateFilterChange('ALL')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          digestDateMode === 'ALL'
                            ? 'bg-[#A855F7] text-white shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        All Digests
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDigestDateFilterChange('TODAY')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          digestDateMode === 'TODAY'
                            ? 'bg-[#A855F7] text-white shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDigestDateFilterChange('YESTERDAY')}
                        className={cn(
                          'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                          digestDateMode === 'YESTERDAY'
                            ? 'bg-[#A855F7] text-white shadow-sm'
                            : 'bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5]',
                        )}
                      >
                        Yesterday
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#9B9BA3]" />
                      <span className="text-xs text-[#9B9BA3]">Custom Date:</span>
                      <input
                        type="date"
                        value={customDigestDate}
                        onChange={(e) => {
                          setCustomDigestDate(e.target.value);
                          if (e.target.value) {
                            void handleDigestDateFilterChange('CUSTOM', e.target.value);
                          }
                        }}
                        className="bg-[#1C1C24] border border-[#23232C] rounded-xl px-3 py-1.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#A855F7]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleGenerateDigest}
                      disabled={isGenerating}
                      className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isGenerating ? 'Synthesizing Standups...' : 'Generate Digest'}
                    </button>
                  </div>

                  {digests.length === 0 ? (
                    <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                      No AI digests found for the selected date filter.
                    </div>
                  ) : (
                    digests.map((d: Record<string, unknown>) => (
                      <div key={d.id as string} className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[#23232C] pb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-[#A855F7]/10 text-[#A855F7]">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-[#F0ECE5]">
                                AI Digest — {new Date(d.digestDate as string).toLocaleDateString()}
                              </h3>
                              <p className="text-xs text-[#9B9BA3]">{d.standupCount as number} standups summarized</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-semibold">
                            <span className="px-2.5 py-1 rounded-lg bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20">
                              {d.aiModel as string}
                            </span>
                          </div>
                        </div>

                        {/* Summary */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-[#E5A320] uppercase tracking-wider flex items-center gap-1.5">
                            ⚡ Executive Summary
                          </h4>
                          <p className="text-sm text-[#D1D1D6] leading-relaxed whitespace-pre-line">
                            {d.summary as string}
                          </p>
                        </div>

                        {/* Key Highlights */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-[#34D399] uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Key Highlights
                          </h4>
                          <p className="text-xs text-[#D1D1D6] whitespace-pre-line leading-relaxed">
                            {d.highlights as string}
                          </p>
                        </div>

                        {/* Concerns & Blockers */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-[#F87171] uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" /> Concerns &amp; Blockers
                          </h4>
                          <p className="text-xs text-[#F87171] whitespace-pre-line leading-relaxed bg-[#F87171]/10 border border-[#F87171]/20 p-3 rounded-xl">
                            {d.concerns as string}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* MEMBERS TAB */}
              {activeTab === 'members' && (
                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-base text-[#F0ECE5]">Team Members ({teamMembersArr.length || 1})</h3>
                  <div className="space-y-2">
                    {teamMembersArr.map((m: Record<string, unknown>) => {
                      const userObj = m.user as { name?: string; email?: string } | undefined;
                      const uName = userObj?.name || userObj?.email || 'User';
                      const roleStr = (m.role as string) || 'MEMBER';

                      return (
                        <div key={m.id as string} className="flex items-center justify-between p-3 rounded-xl bg-[#1C1C24]">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#3B82F6] text-white font-bold text-xs flex items-center justify-center">
                              {uName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#F0ECE5]">{uName}</p>
                              <p className="text-xs text-[#9B9BA3]">{userObj?.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold",
                              roleStr === 'OWNER' ? "bg-[#E5A320]/10 text-[#E5A320]" : "bg-[#9B9BA3]/10 text-[#9B9BA3]"
                            )}>
                              {roleStr}
                            </span>

                            {/* Action buttons (strictly if current user is OWNER or ADMIN, is not themselves, and target is not OWNER) */}
                            {myRoleStr !== 'MEMBER' && m.userId !== activeUserId && roleStr !== 'OWNER' && (
                              <div className="flex items-center gap-2">
                                {/* Make Admin / Demote to Member button (strictly OWNER only) */}
                                {myRoleStr === 'OWNER' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingRoleChange({
                                        memberUserId: m.userId as string,
                                        userName: uName,
                                        targetRole: roleStr === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                                      });
                                    }}
                                    className="bg-[#1C1C24] hover:bg-[#2A2A35] text-[#E5A320] border border-[#E5A320]/20 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    {roleStr === 'ADMIN' ? 'Demote to Member' : 'Make Admin'}
                                  </button>
                                )}

                                {/* Remove Member button */}
                                {(myRoleStr === 'OWNER' || (myRoleStr === 'ADMIN' && roleStr === 'MEMBER')) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPendingRemoveMember({
                                        memberUserId: m.userId as string,
                                        userName: uName,
                                      });
                                    }}
                                    className="bg-[#F87171]/10 hover:bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/20 font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <UserMinus className="w-3.5 h-3.5" />
                                    Remove
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SETTINGS TAB */}
              {activeTab === 'settings' && myRoleStr !== 'MEMBER' && (
                <div className="space-y-6 max-w-4xl">
                  <form onSubmit={handleSaveTeamSettingsSubmit} className="space-y-6">
                    {/* General Settings */}
                    <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                          <SettingsIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base text-[#F0ECE5]">General Team Settings</h3>
                          <p className="text-xs text-[#9B9BA3] mt-0.5">Manage team name and public discoverability</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5">
                            Team Name
                          </label>
                          <input
                            type="text"
                            required
                            value={settingsName}
                            onChange={(e) => setSettingsName(e.target.value)}
                            className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5">
                            Company Name
                          </label>
                          <input
                            type="text"
                            required
                            value={settingsCompany}
                            onChange={(e) => setSettingsCompany(e.target.value)}
                            className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                          />
                        </div>
                      </div>

                      {/* Discoverability Toggle Switch */}
                      <div className="flex items-center justify-between pt-4 border-t border-[#23232C]">
                        <div>
                          <p className="text-sm font-semibold text-[#F0ECE5]">Public Discoverability</p>
                          <p className="text-xs text-[#9B9BA3] mt-0.5">Allow other developers to find this team in public search</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingDiscoverableToggle(!settingsDiscoverable)}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                            settingsDiscoverable ? 'bg-[#E5A320]' : 'bg-[#2A2A35]'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-[#0B0B0F] block transform transition-transform duration-200 ease-in-out ${
                              settingsDiscoverable ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Save General Settings Button */}
                      <div className="flex justify-end pt-3 border-t border-[#23232C]">
                        <button
                          type="button"
                          onClick={() => setShowSaveSettingsModal(true)}
                          disabled={savingSettings}
                          className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save General Settings'}
                        </button>
                      </div>
                    </div>

                    {/* Permissions & Digest Visibility */}
                    {myRoleStr === 'OWNER' && (
                      <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                            <Shield className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-[#F0ECE5]">Permissions &amp; Digest Visibility</h3>
                            <p className="text-xs text-[#9B9BA3] mt-0.5">Configure access control for AI digests</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5 flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" /> Digest Visibility
                            </label>
                            <select
                              value={settingsVisibility}
                              onChange={(e) => setSettingsVisibility(e.target.value)}
                              className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                            >
                              <option value="EVERYONE">Everyone in Team</option>
                              <option value="ADMINS_ONLY">Admins &amp; Owner Only</option>
                              <option value="OWNER_ONLY">Owner Only</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-[#9B9BA3] mb-1.5 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" /> Digest Trigger Permission
                            </label>
                            <select
                              value={settingsTriggerPermission}
                              onChange={(e) => setSettingsTriggerPermission(e.target.value)}
                              className="w-full bg-[#1C1C24] border border-[#23232C] rounded-xl px-4 py-3 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                            >
                              <option value="ALL_MEMBERS">All Team Members</option>
                              <option value="ADMINS_AND_OWNER">Admins &amp; Owner Only</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={savingSettings}
                            className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" /> {savingSettings ? 'Saving...' : 'Save Settings'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Danger Zone */}
                    {myRoleStr === 'OWNER' && (
                      <div className="bg-[#F87171]/5 border border-[#F87171]/20 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 text-[#F87171]">
                          <Trash2 className="w-5 h-5" />
                          <h3 className="font-bold text-base">Danger Zone</h3>
                        </div>
                        <p className="text-xs text-[#9B9BA3]">
                          Deleting a team is permanent. All standup entries, digests, and member data will be deleted.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowDeleteModal(true)}
                          className="bg-[#F87171]/10 hover:bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/30 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
                        >
                          Delete Team
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Confirm Modal for Team Settings Update */}
      <ConfirmModal
        isOpen={showSaveSettingsModal}
        title="Save Team Settings?"
        description={`Are you sure you want to update settings for "${settingsName}"? This will modify discoverability and AI digest access permissions in PostgreSQL.`}
        confirmText="Save Settings"
        cancelText="Cancel"
        onClose={() => setShowSaveSettingsModal(false)}
        onConfirm={executeSaveTeamSettings}
      />

      {/* Confirm Modal for Public Discoverability Toggle */}
      <ConfirmModal
        isOpen={pendingDiscoverableToggle !== null}
        title="Change Public Discoverability?"
        description={`Are you sure you want to make this team ${pendingDiscoverableToggle ? 'PUBLIC' : 'PRIVATE'} in search results?`}
        confirmText="Confirm Change"
        cancelText="Cancel"
        onClose={() => setPendingDiscoverableToggle(null)}
        onConfirm={() => {
          if (pendingDiscoverableToggle !== null) {
            setSettingsDiscoverable(pendingDiscoverableToggle);
            toast.info(pendingDiscoverableToggle ? 'Public discoverability turned ON (click Save Settings to persist)' : 'Public discoverability turned OFF (click Save Settings to persist)');
            setPendingDiscoverableToggle(null);
          }
        }}
      />

      {/* Confirm Modal for Team Deletion */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Team Workspace?"
        description="Are you sure you want to delete this team? All standups, digests, and member permissions will be permanently removed. This action cannot be undone."
        confirmText="Yes, Delete Team"
        cancelText="Cancel"
        isDestructive
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTeam}
      />

      {/* Confirm Modal for Member Removal */}
      <ConfirmModal
        isOpen={pendingRemoveMember !== null}
        title="Remove Member from Team?"
        description={`Are you sure you want to remove ${pendingRemoveMember?.userName} from this workspace? They will lose access to team standups and digests immediately.`}
        confirmText="Remove Member"
        cancelText="Cancel"
        isDestructive
        onClose={() => setPendingRemoveMember(null)}
        onConfirm={executeRemoveMember}
      />

      {/* Confirm Modal for Role Change */}
      <ConfirmModal
        isOpen={pendingRoleChange !== null}
        title="Update Member Role?"
        description={`Are you sure you want to change the role of ${pendingRoleChange?.userName} to ${pendingRoleChange?.targetRole}?`}
        confirmText="Update Role"
        cancelText="Cancel"
        onClose={() => setPendingRoleChange(null)}
        onConfirm={executeRoleChange}
      />
    </div>
  );
}
