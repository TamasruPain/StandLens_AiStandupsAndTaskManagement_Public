'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { Plus, Search, FolderKanban, Loader2, BarChart2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { TaskDetailModal } from '@/components/projects/task-detail-modal';
import { SplashScreen } from '@/components/ui/splash-screen';
import { getIsInitialLoad, setIsInitialLoad } from '@/lib/initial-load';

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  color: string;
  archived: boolean;
  teamId: string;
  todoCount: number;
  inProgressCount: number;
  inReviewCount: number;
  doneCount: number;
  totalCount: number;
  progressPercent: number;
  team: {
    id: string;
    name: string;
  };
}

interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  completionDesc?: string | null;
  subtasks?: { id: string; isDone: boolean }[];
  project?: { id: string; name: string; color: string };
  assignees?: { user: { id: string; name: string; email?: string } }[];
  dueDate?: string | null;
}

interface TeamInfo {
  id: string;
  name: string;
}

export default function ProjectsPage() {
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';
  const toast = useToast();

  const [loading, setLoading] = useState(getIsInitialLoad());
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [userTeams, setUserTeams] = useState<TeamInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'manage' | 'tasks'>('tasks');
  const [ownedTeamsList, setOwnedTeamsList] = useState<TeamInfo[]>([]);
  const [myTasks, setMyTasks] = useState<TaskItem[]>([]);
  const [pendingReviews, setPendingReviews] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskToComplete, setSelectedTaskToComplete] = useState<TaskItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [submittingCompletion, setSubmittingCompletion] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');

  // Create Project Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#5B46F6');
  const [newProjectTeamId, setNewProjectTeamId] = useState('');
  const [creating, setCreating] = useState(false);

  const colors = [
    '#5B46F6', // Indigo
    '#E5A320', // StandLens Gold
    '#10B981', // Emerald
    '#EF4444', // Red
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#8B5CF6', // Purple
  ];

  const loadPageData = useCallback(async () => {
    try {
      const [projectsData, teamsData, tasksData, pendingData] = await Promise.all([
        apiClient.getProjects(activeUserId),
        apiClient.getUserTeams(activeUserId),
        apiClient.getMyAssignedTasks(activeUserId),
        apiClient.getLeaderPendingReviews(activeUserId),
      ]);
      setProjects(projectsData as unknown as ProjectItem[]);
      setMyTasks(tasksData as unknown as TaskItem[]);
      setPendingReviews(pendingData as unknown as TaskItem[]);
      
      const tData = teamsData as { ownedTeams?: TeamInfo[]; memberTeams?: TeamInfo[] };
      const ownedTeams = tData.ownedTeams || [];
      const memberTeams = tData.memberTeams || [];
      const allTeams = [...ownedTeams, ...memberTeams];
      setUserTeams(allTeams);
      setOwnedTeamsList(ownedTeams);
      if (allTeams.length > 0) {
        setNewProjectTeamId(allTeams[0].id as string);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load projects page data', msg);
    }
  }, [activeUserId, toast]);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const initial = getIsInitialLoad();

    Promise.all([
      apiClient.getProjects(activeUserId),
      apiClient.getUserTeams(activeUserId),
      apiClient.getMyAssignedTasks(activeUserId),
      apiClient.getLeaderPendingReviews(activeUserId),
    ])
      .then(([projectsData, teamsData, tasksData, pendingData]) => {
        if (!isMounted) return;
        setProjects(projectsData as unknown as ProjectItem[]);
        setMyTasks(tasksData as unknown as TaskItem[]);
        setPendingReviews(pendingData as unknown as TaskItem[]);
        
        const tData = teamsData as { ownedTeams?: TeamInfo[]; memberTeams?: TeamInfo[] };
        const ownedTeams = tData.ownedTeams || [];
        const memberTeams = tData.memberTeams || [];
        const allTeams = [...ownedTeams, ...memberTeams];
        setUserTeams(allTeams);
        setOwnedTeamsList(ownedTeams);
        if (ownedTeams.length > 0) {
          setActiveTab('manage');
        } else {
          setActiveTab('tasks');
        }
        if (allTeams.length > 0) {
          setNewProjectTeamId(allTeams[0].id as string);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Failed to load projects page data', msg);
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

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !newProjectTeamId) return;

    try {
      setCreating(true);
      await apiClient.createProject(activeUserId, {
        teamId: newProjectTeamId,
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
        color: newProjectColor,
      });

      toast.success('Project created successfully!');
      setShowCreateModal(false);
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectColor('#5B46F6');
      
      void loadPageData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create project', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleMarkTaskCompleted = async () => {
    if (!selectedTaskToComplete) return;
    try {
      setSubmittingCompletion(true);
      await apiClient.updateTask(activeUserId, selectedTaskToComplete.id, {
        status: 'DONE',
        completionDesc: completionNotes.trim() || 'Completed.',
      });
      toast.success('Task marked as completed!');
      setSelectedTaskToComplete(null);
      setCompletionNotes('');
      void loadPageData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to complete task', msg);
    } finally {
      setSubmittingCompletion(false);
    }
  };

  // Filter projects based on query and selected team
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTeam = selectedTeamId === 'ALL' || project.teamId === selectedTeamId;
    return matchesSearch && matchesTeam;
  });

  if (loading) {
    return <SplashScreen message="Loading projects..." />;
  }

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Projects" />

        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Project Board</h1>
              <p className="text-sm text-[#9B9BA3] mt-1">
                Manage your projects and tasks across all your workspaces.
              </p>
            </div>
            
            {ownedTeamsList.length > 0 && activeTab === 'manage' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-[#E5A320]/10 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4.5 h-4.5" /> New Project
              </button>
            )}
          </div>

          {/* Member View Alert Banner */}
          {ownedTeamsList.length === 0 && (
            <div className="bg-[#14141A]/50 border border-[#23232C]/40 rounded-xl p-3.5 flex items-center justify-between text-xs text-[#9B9BA3]">
              <span>ℹ️ You are in Member view. The Project and Task Management tab is only visible to team leaders of teams they created.</span>
            </div>
          )}

          {/* Tabs bar */}
          {ownedTeamsList.length > 0 && (
            <div className="flex gap-2 border-b border-[#23232C] pb-px">
              <button
                onClick={() => setActiveTab('manage')}
                className={cn(
                  "px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer",
                  activeTab === 'manage' 
                    ? "border-[#E5A320] text-[#E5A320]" 
                    : "border-transparent text-[#9B9BA3] hover:text-[#F0ECE5]"
                )}
              >
                Manage Projects & Tasks (Leaders View)
              </button>
              <button
                onClick={() => setActiveTab('tasks')}
                className={cn(
                  "px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer",
                  activeTab === 'tasks' 
                    ? "border-[#E5A320] text-[#E5A320]" 
                    : "border-transparent text-[#9B9BA3] hover:text-[#F0ECE5]"
                )}
              >
                My Assigned Tasks ({myTasks.length})
              </button>
            </div>
          )}

          {activeTab === 'manage' && ownedTeamsList.length > 0 ? (
            <>
              {/* Leader Review Queue */}
              {pendingReviews.length > 0 && (
                <div className="bg-[#E5A320]/5 border border-[#E5A320]/20 rounded-2xl p-5 space-y-3.5 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <h3 className="text-sm font-bold text-[#E5A320] uppercase tracking-wider">
                        Pending Task Approvals ({pendingReviews.length})
                      </h3>
                    </div>
                    <span className="text-[10px] bg-[#E5A320]/15 text-[#E5A320] border border-[#E5A320]/30 px-2 py-0.5 rounded-full font-bold uppercase">
                      Action Required
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pendingReviews.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="bg-[#14141A] border border-[#23232C] hover:border-[#E5A320]/50 rounded-xl p-4 flex flex-col justify-between h-40 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-lg group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-[9px] font-bold text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-1.5 py-0.5 rounded border border-[#23232C] truncate">
                              {task.project?.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-[#E5A320]/10 text-[#E5A320]">
                              In Review
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors truncate">
                            {task.title}
                          </h4>
                          <p className="text-[11px] text-[#71717A] mt-1.5 line-clamp-2">
                            {task.completionDesc ? `"${task.completionDesc}"` : 'No completion notes provided.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#1C1C24] pt-2 mt-2">
                          <span className="text-[10px] text-[#71717A] truncate max-w-[150px]">
                            By: {task.assignees?.map((a) => a.user?.name || a.user?.email).join(', ') || 'Unassigned'}
                          </span>
                          <span className="text-[9px] text-[#E5A320] font-bold underline group-hover:no-underline shrink-0">
                            Review &rarr;
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[#14141A] border border-[#23232C] p-4 rounded-2xl">
                {/* Search */}
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555566]" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl pl-10 pr-4 py-2 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors"
                  />
                </div>

                {/* Team Filter */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <span className="text-xs text-[#9B9BA3] shrink-0">Filter by Team:</span>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full md:w-48 bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                  >
                    <option value="ALL">All Teams</option>
                    {userTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main Grid content */}
              {filteredProjects.length === 0 ? (
                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto mt-10">
                  <div className="w-16 h-16 rounded-full bg-[#1F1F26] flex items-center justify-center mb-4 text-[#9B9BA3]">
                    <FolderKanban className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-[#F0ECE5]">No Projects Found</h3>
                  <p className="text-xs text-[#9B9BA3] mt-2 max-w-sm">
                    Get started by creating your first project for your team to track daily progress.
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-6 bg-[#E5A320] hover:bg-[#F5B731] text-[#0B0B0F] font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                    Create Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map((project) => (
                    <Link
                      href={`/projects/${project.id}`}
                      key={project.id}
                      className="bg-[#14141A] border border-[#23232C] hover:border-[#383846] rounded-2xl p-5 hover:shadow-xl transition-all duration-200 group flex flex-col justify-between h-48 cursor-pointer relative overflow-hidden"
                    >
                      {/* Color strip accent */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: project.color }}
                      />

                      <div>
                        {/* Team tag & title */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold uppercase text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-2 py-0.5 rounded border border-[#23232C]">
                            {project.team?.name}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors truncate">
                          {project.name}
                        </h3>
                        <p className="text-xs text-[#9B9BA3] mt-1.5 line-clamp-2 leading-relaxed">
                          {project.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Task counts progress */}
                      <div className="space-y-2 mt-4">
                        <div className="flex justify-between items-center text-[10px] text-[#71717A] font-semibold">
                          <span className="flex items-center gap-1">
                            <BarChart2 className="w-3 h-3 text-[#E5A320]" />
                            {project.doneCount}/{project.totalCount} Tasks Complete
                          </span>
                          <span>{project.progressPercent}%</span>
                        </div>

                        <div className="h-1.5 w-full bg-[#1C1C24] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${project.progressPercent}%`,
                              backgroundColor: project.color,
                            }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6">
              {myTasks.length === 0 ? (
                <div className="bg-[#14141A] border border-[#23232C] rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto mt-10">
                  <div className="w-16 h-16 rounded-full bg-[#1F1F26] flex items-center justify-center mb-4 text-[#9B9BA3]">
                    <FolderKanban className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-[#F0ECE5]">No Tasks Assigned</h3>
                  <p className="text-xs text-[#9B9BA3] mt-2 max-w-sm">
                    You do not have any tasks assigned to you right now. Enjoy the free time!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myTasks.map((task) => {
                    const statusPercent = (() => {
                      if (task.subtasks && task.subtasks.length > 0) {
                        const completed = task.subtasks.filter((s) => s.isDone).length;
                        return Math.round((completed / task.subtasks.length) * 100);
                      }
                      return task.status === 'DONE' ? 100 : task.status === 'IN_REVIEW' ? 80 : task.status === 'IN_PROGRESS' ? 50 : 0;
                    })();
                    const statusColor = task.status === 'DONE' ? 'bg-[#10B981]' : task.status === 'IN_REVIEW' ? 'bg-[#E5A320]' : task.status === 'IN_PROGRESS' ? 'bg-[#5B46F6]' : 'bg-[#71717A]';
                    return (
                      <div
                        key={task.id}
                        className="bg-[#14141A] border border-[#23232C] rounded-2xl p-5 flex flex-col justify-between h-56 relative overflow-hidden"
                      >
                        {/* Project Indicator strip */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1"
                          style={{ backgroundColor: task.project?.color || '#5B46F6' }}
                        />

                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[9px] font-bold uppercase text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-2 py-0.5 rounded border border-[#23232C] truncate max-w-[120px]">
                              {task.project?.name || 'Project'}
                            </span>
                            <span className={cn(
                              "text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                              task.priority === 'URGENT' ? 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20' :
                              task.priority === 'HIGH' ? 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20' :
                              task.priority === 'MEDIUM' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20' :
                              'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
                            )}>
                              {task.priority}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-[#F0ECE5] line-clamp-1">
                            {task.title}
                          </h3>
                          <p className="text-xs text-[#9B9BA3] mt-1.5 line-clamp-2 leading-relaxed">
                            {task.description || 'No description provided.'}
                          </p>
                        </div>

                        {/* Progress Bar & Actions */}
                        <div className="space-y-3.5 mt-3 border-t border-[#1C1C24] pt-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-[#71717A] uppercase font-bold tracking-wider">
                              <span className="flex items-center gap-1">
                                Progress
                                {task.subtasks && task.subtasks.length > 0 && (
                                  <span className="text-[#9B9BA3] lowercase font-semibold">
                                    ({task.subtasks.filter((s) => s.isDone).length}/{task.subtasks.length} subtasks)
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

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#71717A]">
                              Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'}
                            </span>

                            {task.status === 'DONE' ? (
                              <span className="text-[10px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded-lg">
                                ✓ Completed
                              </span>
                            ) : task.status === 'IN_REVIEW' ? (
                              <span className="text-[10px] font-bold text-[#E5A320] bg-[#E5A320]/10 border border-[#E5A320]/20 px-2.5 py-1 rounded-lg">
                                ⏳ In Review
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedTaskToComplete(task)}
                                className="bg-[#5B46F6] hover:bg-[#5B46F6]/90 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Complete Task
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm"
            onClick={() => !creating && setShowCreateModal(false)}
          />

          {/* Modal Container */}
          <form
            onSubmit={handleCreateProject}
            className="relative w-full max-w-md bg-[#14141A] border border-[#23232C] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
              <h2 className="text-base font-bold text-[#F0ECE5]">Create New Project</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1.5 hover:bg-[#1C1C24] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Select Team */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider">
                Select Team Workspace
              </label>
              <select
                value={newProjectTeamId}
                onChange={(e) => setNewProjectTeamId(e.target.value)}
                disabled={creating}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                required
              >
                {userTeams.length === 0 ? (
                  <option value="">No teams available (Join or Create one first)</option>
                ) : (
                  userTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider">
                Project Name
              </label>
              <input
                type="text"
                placeholder="e.g. Website Redesign"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                disabled={creating}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                placeholder="Describe the goals and scope of this project..."
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                disabled={creating}
                rows={3}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
              />
            </div>

            {/* Color accent */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Theme Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProjectColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all cursor-pointer hover:scale-105 active:scale-95',
                      newProjectColor === c ? 'border-[#F0ECE5]' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[#23232C] pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="text-xs font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] px-4 py-2 hover:bg-[#1C1C24] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || userTeams.length === 0}
                className="bg-[#E5A320] hover:bg-[#F5B731] disabled:bg-[#1A1A22] text-[#0B0B0F] disabled:text-[#555566] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Complete Task Modal Overlay */}
      {selectedTaskToComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm"
            onClick={() => !submittingCompletion && setSelectedTaskToComplete(null)}
          />

          <div className="relative w-full max-w-md bg-[#14141A] border border-[#23232C] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
              <h2 className="text-base font-bold text-[#F0ECE5]">Submit Task Completion</h2>
              <button
                type="button"
                onClick={() => setSelectedTaskToComplete(null)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1.5 hover:bg-[#1C1C24] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-[#9B9BA3] uppercase tracking-wider">Task</h4>
              <p className="text-sm font-semibold text-[#F0ECE5]">{selectedTaskToComplete.title}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Completion Notes (Optional)
              </label>
              <textarea
                placeholder="Write any relevant notes or feedback regarding your completion of this task..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                disabled={submittingCompletion}
                rows={4}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#23232C] pt-4 mt-2">
              <button
                type="button"
                onClick={() => setSelectedTaskToComplete(null)}
                disabled={submittingCompletion}
                className="text-xs font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] px-4 py-2 hover:bg-[#1C1C24] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkTaskCompleted}
                disabled={submittingCompletion}
                className="bg-[#10B981] hover:bg-[#10B981]/90 disabled:bg-[#1A1A22] text-white disabled:text-[#555566] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submittingCompletion ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={() => {
          void loadPageData();
        }}
        activeUserId={activeUserId}
      />
    </div>
  );
}
