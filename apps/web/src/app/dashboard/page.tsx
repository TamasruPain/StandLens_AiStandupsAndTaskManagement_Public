'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ClipboardList, Bell, Sparkles, ArrowRight, FolderKanban, CheckSquare } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { TaskDetailModal } from '@/components/projects/task-detail-modal';
import { ProjectDetailModal } from '@/components/projects/project-detail-modal';
import { SplashScreen } from '@/components/ui/splash-screen';
import { cn } from '@/lib/utils';
import { getIsInitialLoad, setIsInitialLoad } from '@/lib/initial-load';

interface TeamsDataState {
  ownedTeams: Record<string, unknown>[];
  memberTeams: Record<string, unknown>[];
  incomingRequests: Record<string, unknown>[];
  sentRequests: Record<string, unknown>[];
}

interface Subtask {
  id: string;
  title: string;
  isDone: boolean;
}

interface Project {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  tasksCount?: number;
  completedTasksCount?: number;
  doneCount?: number;
  totalCount?: number;
  progressPercent?: number;
  team?: {
    id: string;
    name: string;
  };
}

interface Task {
  id: string;
  title: string;
  priority: string;
  status: string;
  subtasks?: Subtask[];
  project?: Project;
  dueDate?: string | null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(getIsInitialLoad());

  // Live state from API
  const [teamsData, setTeamsData] = useState<TeamsDataState>({
    ownedTeams: [],
    memberTeams: [],
    incomingRequests: [],
    sentRequests: [],
  });
  const [groupedDigests, setGroupedDigests] = useState<Record<string, unknown>[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('Good morning');

  useEffect(() => {
    const hour = new Date().getHours();
    const currentGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(currentGreeting);
  }, []);

  // Fallback test user ID from DB seed if unauthenticated in dev
  const activeUserId = session?.user?.id || 'demo-user-alex';

  const loadDashboardData = useCallback(async () => {
    try {
      const [teamsRes, digestsRes, projectsRes, tasksRes] = await Promise.all([
        apiClient.getUserTeams(activeUserId).catch(() => ({
          ownedTeams: [],
          memberTeams: [],
          incomingRequests: [],
          sentRequests: [],
        })),
        apiClient.getGroupedUserDigests(activeUserId).catch(() => []),
        apiClient.getProjects(activeUserId).catch(() => []),
        apiClient.getMyAssignedTasks(activeUserId).catch(() => []),
      ]);

      setTeamsData(teamsRes as unknown as TeamsDataState);
      setGroupedDigests(digestsRes as Record<string, unknown>[]);
      setProjects(projectsRes as Project[]);
      setMyTasks(tasksRes as Task[]);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, [activeUserId]);

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      const startTime = Date.now();
      const initial = getIsInitialLoad();
      
      await loadDashboardData();
      
      const elapsed = Date.now() - startTime;
      if (initial && elapsed < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 2000 - elapsed));
      }
      
      if (initial) {
        setIsInitialLoad(false);
      }
      if (isMounted) setLoading(false);
    };
    void fetchAll();
    return () => {
      isMounted = false;
    };
  }, [loadDashboardData]);

  const userName = session?.user?.name || 'Tamas Varga';

  // Compute stat metrics
  const totalTeams = (teamsData.ownedTeams?.length || 0) + (teamsData.memberTeams?.length || 0);
  const pendingRequestsCount = teamsData.incomingRequests?.length || 0;
  const allTeams = [...(teamsData.ownedTeams || []), ...(teamsData.memberTeams || [])];

  if (loading) {
    return <SplashScreen message="Loading dashboard..." />;
  }

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Header title="Dashboard" />

        <main className="p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Greeting Banner */}
          <div>
            <h2 className="text-3xl font-extrabold text-[#F0ECE5] tracking-tight">
              {greeting}, {userName} 👋
            </h2>
            <p className="text-sm text-[#9B9BA3] mt-1">
              Here is what is happening across your standup teams today.
            </p>
          </div>
            <>
              {/* Stats Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-[#E5A320]/10 text-[#E5A320]">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9B9BA3] uppercase tracking-wider">Active Teams</p>
                    <p className="text-2xl font-bold text-[#F0ECE5]">{totalTeams}</p>
                  </div>
                </div>

                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-[#3B82F6]/10 text-[#3B82F6]">
                    <FolderKanban className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9B9BA3] uppercase tracking-wider">Active Projects</p>
                    <p className="text-2xl font-bold text-[#F0ECE5]">{projects.length}</p>
                  </div>
                </div>

                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-[#10B981]/10 text-[#10B981]">
                    <CheckSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9B9BA3] uppercase tracking-wider">Assigned Tasks</p>
                    <p className="text-2xl font-bold text-[#F0ECE5]">
                      {myTasks.filter(t => t.status !== 'DONE').length}
                    </p>
                  </div>
                </div>

                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-[#A855F7]/10 text-[#A855F7]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#9B9BA3] uppercase tracking-wider">AI Digests</p>
                    <p className="text-2xl font-bold text-[#F0ECE5]">{groupedDigests.length}</p>
                  </div>
                </div>
              </div>

              {/* Action Prompt */}
              {pendingRequestsCount > 0 && (
                <div className="bg-[#E5A320]/10 border border-[#E5A320]/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-[#E5A320]">
                    <Bell className="w-4 h-4 shrink-0" />
                    <span>
                      You have <strong>{pendingRequestsCount} pending join request(s)</strong> waiting for approval.
                    </span>
                  </div>
                  <Link
                    href="/teams"
                    className="text-xs font-bold bg-[#E5A320] text-[#0B0B0F] px-3.5 py-1.5 rounded-xl hover:bg-[#F5B731] transition-colors"
                  >
                    Review Requests
                  </Link>
                </div>
              )}

              {/* Quick Actions / Your Teams Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#F0ECE5]">Your Standup Workspaces</h3>
                  <Link href="/teams" className="text-xs font-bold text-[#E5A320] hover:underline flex items-center gap-1">
                    Manage teams <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {allTeams.length === 0 ? (
                  <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                    You haven&apos;t joined any teams yet.{' '}
                    <Link href="/teams" className="text-[#E5A320] underline font-bold">
                      Find or create a team →
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {allTeams.map((team: Record<string, unknown>) => {
                      const countObj = team._count as { members?: number } | undefined;
                      return (
                        <div
                          key={team.id as string}
                          className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex items-center justify-between hover:border-[#333342] transition-colors"
                        >
                          <div>
                            <h4 className="font-bold text-[#F0ECE5] text-base">{team.name as string}</h4>
                            <p className="text-xs text-[#9B9BA3] mt-1">
                              {team.companyName as string} · {countObj?.members || 1} members
                            </p>
                          </div>
                          <Link
                            href={`/teams/${team.id as string}?tab=standups`}
                            className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-md shrink-0"
                          >
                            Submit Standup
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Active Projects Progress */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#F0ECE5]">Active Projects</h3>
                  <Link href="/projects" className="text-xs font-bold text-[#E5A320] hover:underline flex items-center gap-1">
                    Manage projects <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {projects.length === 0 ? (
                  <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                    No active projects. Click &quot;Manage projects&quot; to create one!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {projects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className="bg-[#14141A] border border-[#23232C] hover:border-[#383846] rounded-2xl p-5 hover:shadow-xl transition-all duration-200 group flex flex-col justify-between h-40 cursor-pointer relative overflow-hidden"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ backgroundColor: project.color || '#5B46F6' }}
                        />
                        <div>
                          <span className="text-[9px] font-bold uppercase text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-2 py-0.5 rounded border border-[#23232C]">
                            {project.team?.name}
                          </span>
                          <h4 className="font-bold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors truncate mt-2 text-sm">
                            {project.name}
                          </h4>
                        </div>
                        <div className="space-y-1.5 mt-4">
                          <div className="flex justify-between items-center text-[10px] text-[#71717A] font-semibold">
                            <span>{project.doneCount}/{project.totalCount} Tasks</span>
                            <span>{project.progressPercent}%</span>
                          </div>
                          <div className="h-1 w-full bg-[#1C1C24] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300 bg-[#E5A320]"
                              style={{ width: `${project.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Your Assigned Tasks Overview */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#F0ECE5]">Your Assigned Tasks</h3>
                  <Link href="/projects" className="text-xs font-bold text-[#E5A320] hover:underline flex items-center gap-1">
                    All tasks <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {myTasks.filter(t => t.status !== 'DONE').length === 0 ? (
                  <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                    No active tasks assigned to you. Enjoy your day! 🎉
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {myTasks.filter(t => t.status !== 'DONE').slice(0, 4).map((task) => {
                      const statusPercent = (() => {
                        if (task.subtasks && task.subtasks.length > 0) {
                          const completed = task.subtasks.filter((s: Subtask) => s.isDone).length;
                          return Math.round((completed / task.subtasks.length) * 100);
                        }
                        return task.status === 'DONE' ? 100 : task.status === 'IN_REVIEW' ? 80 : task.status === 'IN_PROGRESS' ? 50 : 0;
                      })();
                      const statusColor = task.status === 'DONE' ? 'bg-[#10B981]' : task.status === 'IN_REVIEW' ? 'bg-[#E5A320]' : task.status === 'IN_PROGRESS' ? 'bg-[#5B46F6]' : 'bg-[#71717A]';

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className="bg-[#14141A] border border-[#23232C] hover:border-[#383846] rounded-2xl p-5 flex flex-col justify-between h-48 cursor-pointer relative overflow-hidden group transition-all"
                        >
                          <div
                            className="absolute top-0 left-0 right-0 h-1"
                            style={{ backgroundColor: task.project?.color || '#5B46F6' }}
                          />
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[9px] font-bold uppercase text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-2 py-0.5 rounded border border-[#23232C] truncate">
                                {task.project?.name}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                                task.priority === 'URGENT' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' :
                                task.priority === 'HIGH' ? 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20' :
                                task.priority === 'MEDIUM' ? 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20' :
                                'bg-[#71717A]/10 text-[#71717A] border-[#71717A]/20'
                              )}>
                                {task.priority}
                              </span>
                            </div>
                            <h4 className="font-bold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors truncate text-sm">
                              {task.title}
                            </h4>
                          </div>

                          <div className="space-y-3.5 mt-3 border-t border-[#1C1C24] pt-3">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] text-[#71717A] uppercase font-bold tracking-wider">
                                <span className="flex items-center gap-1">
                                  Progress
                                  {task.subtasks && task.subtasks.length > 0 && (
                                    <span className="text-[#9B9BA3] lowercase font-semibold">
                                      ({task.subtasks.filter((s: Subtask) => s.isDone).length}/{task.subtasks.length} subtasks)
                                    </span>
                                  )}
                                </span>
                                <span>{statusPercent}% ({task.status})</span>
                              </div>
                              <div className="w-full bg-[#1C1C24] h-1 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-300", statusColor)}
                                  style={{ width: `${statusPercent}%` }}
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-[#71717A]">
                              <span>
                                Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'}
                              </span>
                              <span className="text-[9px] text-[#E5A320] font-bold group-hover:underline">
                                Details &rarr;
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Recent Digests Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-[#F0ECE5]">Recent AI Digests</h3>
                  <Link
                    href="/digests"
                    className="text-xs font-bold text-[#E5A320] hover:underline flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {groupedDigests.length === 0 ? (
                  <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-8 text-center text-[#9B9BA3] text-sm">
                    No digests generated yet. Select a team to generate your first AI Digest!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {groupedDigests.map((group: Record<string, unknown>) => {
                      const digestsArr = (group.digests as Record<string, unknown>[]) || [];
                      const latestDigest = digestsArr[0];

                      return (
                        <div
                          key={group.teamId as string}
                          className="bg-[#14141A] border border-[#23232C] rounded-2xl p-6 flex flex-col justify-between space-y-4 hover:border-[#333342] transition-colors"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-[#F0ECE5]">{group.teamName as string}</h4>
                              <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#A855F7]/10 text-[#A855F7] flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> AI
                              </span>
                            </div>
                            <p className="text-xs text-[#9B9BA3] mt-1">{group.companyName as string}</p>

                            {latestDigest && (
                              <p className="text-xs text-[#D1D1D6] mt-3 line-clamp-3 bg-[#1C1C24] p-3 rounded-xl leading-relaxed">
                                {latestDigest.summary as string}
                              </p>
                            )}
                          </div>

                          <Link
                            href={`/teams/${group.teamId as string}?tab=digest`}
                            className="text-xs font-bold text-[#E5A320] hover:underline flex items-center gap-1 pt-2 border-t border-[#23232C]"
                          >
                            Read full digest <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
        </main>
      </div>
      {/* Task Detail Slide-over Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={() => {
          void loadDashboardData();
        }}
        activeUserId={activeUserId}
      />
      {/* Project Detail Slide-over Modal */}
      <ProjectDetailModal
        projectId={selectedProjectId}
        isOpen={!!selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
        activeUserId={activeUserId}
        onTaskClick={(taskId) => {
          setSelectedProjectId(null);
          setSelectedTaskId(taskId);
        }}
      />
    </div>
  );
}
