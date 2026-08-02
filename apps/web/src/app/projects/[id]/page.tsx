'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TaskCard, Task } from '@/components/projects/task-card';
import { TaskDetailModal } from '@/components/projects/task-detail-modal';
import {
  FolderKanban,
  List,
  Plus,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Trash2,
  X,
  Clock,
  HelpCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/lib/auth-client';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';

interface TeamMember {
  userId: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string;
    image: string | null;
  };
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  team: {
    id: string;
    name: string;
    members: TeamMember[];
  };
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;
  const { data: session } = useSession();
  const activeUserId = session?.user?.id || 'demo-user-alex';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Page view mode
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  // Modal / Form state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [createTaskStatus, setCreateTaskStatus] = useState<'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'>('TODO');

  // Create Task DTO values
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [submittingTask, setSubmittingTask] = useState(false);

  // Settings State (Modal)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectColor, setProjectColor] = useState('#5B46F6');
  const [savingSettings, setSavingSettings] = useState(false);

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

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    try {
      const [projectDetails, tasksData] = await Promise.all([
        apiClient.getProjectDetails(activeUserId, projectId),
        apiClient.getTasks(activeUserId, projectId),
      ]);
      
      setProject(projectDetails as unknown as ProjectData);
      setProjectName(projectDetails.name as string);
      setProjectDesc((projectDetails.description as string) || '');
      setProjectColor(projectDetails.color as string);
      setTasks(tasksData as unknown as Task[]);
      
      // Save team members list
      const members = (projectDetails.team as Record<string, unknown>)?.members as TeamMember[] || [];
      setTeamMembers(members);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load project details', msg);
      router.push('/projects');
    }
  }, [projectId, activeUserId, toast, router]);

  useEffect(() => {
    let isMounted = true;
    if (!projectId) return;

    Promise.all([
      apiClient.getProjectDetails(activeUserId, projectId),
      apiClient.getTasks(activeUserId, projectId),
    ])
      .then(([projectDetails, tasksData]) => {
        if (!isMounted) return;
        setProject(projectDetails as unknown as ProjectData);
        setProjectName(projectDetails.name as string);
        setProjectDesc((projectDetails.description as string) || '');
        setProjectColor(projectDetails.color as string);
        setTasks(tasksData as unknown as Task[]);
        
        const members = (projectDetails.team as Record<string, unknown>)?.members as TeamMember[] || [];
        setTeamMembers(members);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Failed to load project details', msg);
        router.push('/projects');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [projectId, activeUserId, toast, router]);

  // Real-time synchronization via custom notifications-sse event bus
  useEffect(() => {
    const handleSseUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const payload = customEvent.detail;

      // Ensure the event relates to this specific project
      if (payload.projectId === projectId) {
        if (payload.type === 'TASK_CREATED') {
          setTasks((prev) => {
            if (prev.some((t) => t.id === payload.task.id)) return prev;
            return [...prev, payload.task];
          });
        } else if (payload.type === 'TASK_UPDATED') {
          setTasks((prev) =>
            prev.map((t) => (t.id === payload.task.id ? { ...t, ...payload.task } : t))
          );
        } else if (payload.type === 'TASK_DELETED') {
          setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
        } else if (payload.type === 'TASK_COMMENT_ADDED') {
          // If the task detail is open, we reload it. Otherwise we increment comments count
          if (selectedTaskId === payload.taskId) {
            // Trigger detail reload
            const reloadBtn = document.getElementById('reload-trigger-button');
            if (reloadBtn) reloadBtn.click();
          }
          setTasks((prev) =>
            prev.map((t) =>
              t.id === payload.taskId
                ? { ...t, _count: { comments: (t._count?.comments || 0) + 1 } }
                : t
            )
          );
        }
      }
    };

    window.addEventListener('notifications-sse', handleSseUpdate);
    return () => {
      window.removeEventListener('notifications-sse', handleSseUpdate);
    };
  }, [projectId, selectedTaskId]);

  const handleUpdateTaskStatus = async (taskId: string, targetStatus: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE') => {
    // Optimistic Update
    const originalTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await apiClient.updateTask(activeUserId, taskId, { status: targetStatus });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to change task column', msg);
      // Rollback
      setTasks(originalTasks);
    }
  };

  const activeMember = teamMembers.find((m) => m.userId === activeUserId || m.user?.id === activeUserId);
  const isLeader = !!(activeMember && (activeMember.role === 'OWNER' || activeMember.role === 'ADMIN'));
  const isOwner = !!(activeMember && activeMember.role === 'OWNER');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE') => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;
    
    if (targetStatus === 'DONE' && !isLeader) {
      toast.error('Only team leaders can mark tasks as completed directly. Click the task to submit completion for review.');
      return;
    }
    
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      void handleUpdateTaskStatus(taskId, targetStatus);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    try {
      setSubmittingTask(true);
      await apiClient.createTask(activeUserId, {
        projectId,
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        status: createTaskStatus,
        priority: taskPriority,
        assigneeIds: taskAssigneeIds,
        dueDate: taskDueDate || undefined,
      });

      toast.success('Task created successfully!');
      setShowCreateTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskPriority('MEDIUM');
      setTaskAssigneeIds([]);
      setTaskDueDate('');
      
      void loadProjectData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create task', msg);
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUpdateProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      setSavingSettings(true);
      const updated = await apiClient.updateProject(activeUserId, projectId, {
        name: projectName.trim(),
        description: projectDesc.trim() || null,
        color: projectColor,
      });
      setProject(updated as unknown as ProjectData);
      toast.success('Project configuration updated!');
      setShowSettingsModal(false);
      void loadProjectData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update project settings', msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete this project? This will permanently remove all associated tasks.')) return;
    try {
      setSavingSettings(true);
      await apiClient.deleteProject(activeUserId, projectId);
      toast.success('Project deleted');
      router.push('/projects');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to delete project', msg);
    } finally {
      setSavingSettings(false);
    }
  };

  // Group tasks by status columns
  const getTasksByStatus = (status: string) => {
    return tasks.filter((t) => t.status === status);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex min-h-screen bg-[#0B0B0F] text-[#F0ECE5]">
      <Sidebar />

      {/* Hidden button used to programmatically trigger detail reload on real-time comment notification */}
      <button
        id="reload-trigger-button"
        className="hidden"
        onClick={() => {
          if (selectedTaskId) {
            // Trigger refresh inside TaskDetailModal without full page load spinner
            const reloadFunc = (window as unknown as { refreshOpenTaskDetails?: () => void }).refreshOpenTaskDetails;
            if (typeof reloadFunc === 'function') reloadFunc();
          }
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title={(project?.name as string) || 'Project Detail'} />

        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto flex flex-col">
          
          {/* Top Breadcrumb & Controls */}
          {loading ? (
            <div className="flex-1 flex justify-center items-center">
              <Loader2 className="w-8 h-8 text-[#E5A320] animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <Link
                    href="/projects"
                    className="p-2 bg-[#14141A] border border-[#23232C] rounded-xl hover:bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5] transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4.5 h-4.5" />
                  </Link>

                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold tracking-tight">{project?.name}</h1>
                      <div
                        className="w-3 h-3 rounded-full shadow-inner border border-white/10"
                        style={{ backgroundColor: project?.color }}
                      />
                    </div>
                    <p className="text-xs text-[#9B9BA3] mt-0.5">
                      Team: <span className="font-semibold">{project?.team?.name}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Switcher Toggle */}
                  <div className="flex items-center bg-[#14141A] border border-[#23232C] p-1 rounded-xl">
                    <button
                      onClick={() => setViewMode('board')}
                      className={cn(
                        'p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                        viewMode === 'board'
                          ? 'bg-[#1C1C24] text-[#E5A320] shadow-sm border border-[#2A2A35]'
                          : 'text-[#9B9BA3] hover:text-[#F0ECE5]',
                      )}
                    >
                      <FolderKanban className="w-4 h-4" /> Board
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={cn(
                        'p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
                        viewMode === 'list'
                          ? 'bg-[#1C1C24] text-[#E5A320] shadow-sm border border-[#2A2A35]'
                          : 'text-[#9B9BA3] hover:text-[#F0ECE5]',
                      )}
                    >
                      <List className="w-4 h-4" /> List
                    </button>
                  </div>

                  {/* Actions / Settings */}
                  {isLeader && (
                    <button
                      onClick={() => setShowSettingsModal(true)}
                      className="bg-[#14141A] border border-[#23232C] hover:bg-[#1C1C24] hover:border-[#383846] text-[#F0ECE5] font-semibold text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>

              {/* Leader review attention banner */}
              {isLeader && tasks.some((t) => t.status === 'IN_REVIEW') && (
                <div className="bg-[#E5A320]/10 border border-[#E5A320]/20 rounded-2xl p-4 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#E5A320] flex items-center gap-1.5 uppercase tracking-wider">
                      ⚠️ Attention Required
                    </span>
                    <span className="text-xs text-[#9B9BA3]">
                      You have {tasks.filter((t) => t.status === 'IN_REVIEW').length} task completion submissions pending review.
                    </span>
                  </div>
                  <span className="text-[10px] bg-[#E5A320] text-[#000] px-2 py-0.5 rounded-full font-bold uppercase">
                    Pending Leader Action
                  </span>
                </div>
              )}

              {/* View Output */}
              <div className="flex-1 min-h-0 flex flex-col">
                {viewMode === 'board' ? (
                  /* KANBAN BOARD VIEW */
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-0 overflow-x-auto pb-4">
                    
                    {/* TODO Column */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'TODO')}
                      className="bg-[#0E0E12] border border-[#1F1F26] rounded-2xl p-4 flex flex-col gap-4 max-h-full min-w-[240px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#1C1C24] pb-2">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-[#9B9BA3]" />
                          <span className="text-xs font-bold text-[#F0ECE5] uppercase">To Do</span>
                        </div>
                        <span className="bg-[#1C1C24] text-xs text-[#9B9BA3] px-2 py-0.5 rounded-full font-bold">
                          {getTasksByStatus('TODO').length}
                        </span>
                      </div>

                      <div className="space-y-3 overflow-y-auto flex-1 max-h-[500px] pr-1">
                        {getTasksByStatus('TODO').map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>

                      {isLeader && (
                        <button
                          onClick={() => {
                            setCreateTaskStatus('TODO');
                            setShowCreateTaskModal(true);
                          }}
                          className="w-full py-2.5 border border-dashed border-[#23232C] hover:border-[#E5A320]/40 rounded-xl text-xs text-[#9B9BA3] hover:text-[#E5A320] hover:bg-[#E5A320]/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1 font-semibold"
                        >
                          <Plus className="w-4 h-4" /> Add Task
                        </button>
                      )}
                    </div>

                    {/* IN PROGRESS Column */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'IN_PROGRESS')}
                      className="bg-[#0E0E12] border border-[#1F1F26] rounded-2xl p-4 flex flex-col gap-4 max-h-full min-w-[240px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#1C1C24] pb-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-[#F59E0B]" />
                          <span className="text-xs font-bold text-[#F0ECE5] uppercase">In Progress</span>
                        </div>
                        <span className="bg-[#1C1C24] text-xs text-[#9B9BA3] px-2 py-0.5 rounded-full font-bold">
                          {getTasksByStatus('IN_PROGRESS').length}
                        </span>
                      </div>

                      <div className="space-y-3 overflow-y-auto flex-1 max-h-[500px] pr-1">
                        {getTasksByStatus('IN_PROGRESS').map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>

                      {isLeader && (
                        <button
                          onClick={() => {
                            setCreateTaskStatus('IN_PROGRESS');
                            setShowCreateTaskModal(true);
                          }}
                          className="w-full py-2.5 border border-dashed border-[#23232C] hover:border-[#E5A320]/40 rounded-xl text-xs text-[#9B9BA3] hover:text-[#E5A320] hover:bg-[#E5A320]/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1 font-semibold"
                        >
                          <Plus className="w-4 h-4" /> Add Task
                        </button>
                      )}
                    </div>

                    {/* IN REVIEW Column */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'IN_REVIEW')}
                      className="bg-[#0E0E12] border border-[#1F1F26] rounded-2xl p-4 flex flex-col gap-4 max-h-full min-w-[240px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#1C1C24] pb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-[#5B46F6]" />
                          <span className="text-xs font-bold text-[#F0ECE5] uppercase">In Review</span>
                        </div>
                        <span className="bg-[#1C1C24] text-xs text-[#9B9BA3] px-2 py-0.5 rounded-full font-bold">
                          {getTasksByStatus('IN_REVIEW').length}
                        </span>
                      </div>

                      <div className="space-y-3 overflow-y-auto flex-1 max-h-[500px] pr-1">
                        {getTasksByStatus('IN_REVIEW').map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>

                      {isLeader && (
                        <button
                          onClick={() => {
                            setCreateTaskStatus('IN_REVIEW');
                            setShowCreateTaskModal(true);
                          }}
                          className="w-full py-2.5 border border-dashed border-[#23232C] hover:border-[#E5A320]/40 rounded-xl text-xs text-[#9B9BA3] hover:text-[#E5A320] hover:bg-[#E5A320]/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1 font-semibold"
                        >
                          <Plus className="w-4 h-4" /> Add Task
                        </button>
                      )}
                    </div>

                    {/* DONE Column */}
                    <div
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, 'DONE')}
                      className="bg-[#0E0E12] border border-[#1F1F26] rounded-2xl p-4 flex flex-col gap-4 max-h-full min-w-[240px]"
                    >
                      <div className="flex items-center justify-between border-b border-[#1C1C24] pb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[#10B981]" />
                          <span className="text-xs font-bold text-[#F0ECE5] uppercase">Completed</span>
                        </div>
                        <span className="bg-[#1C1C24] text-xs text-[#9B9BA3] px-2 py-0.5 rounded-full font-bold">
                          {getTasksByStatus('DONE').length}
                        </span>
                      </div>

                      <div className="space-y-3 overflow-y-auto flex-1 max-h-[500px] pr-1">
                        {getTasksByStatus('DONE').map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => setSelectedTaskId(task.id)}
                          />
                        ))}
                      </div>

                      {isLeader && (
                        <button
                          onClick={() => {
                            setCreateTaskStatus('DONE');
                            setShowCreateTaskModal(true);
                          }}
                          className="w-full py-2.5 border border-dashed border-[#23232C] hover:border-[#E5A320]/40 rounded-xl text-xs text-[#9B9BA3] hover:text-[#E5A320] hover:bg-[#E5A320]/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1 font-semibold"
                        >
                          <Plus className="w-4 h-4" /> Add Task
                        </button>
                      )}
                    </div>

                  </div>
                ) : (
                  /* LIST VIEW TABLE */
                  <div className="flex-1 bg-[#14141A] border border-[#23232C] rounded-2xl overflow-hidden shadow-xl flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#23232C] text-[10px] uppercase font-bold text-[#555566] tracking-wider bg-[#0E0E12]">
                            <th className="py-3 px-4">Task Name</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Priority</th>
                            <th className="py-3 px-4">Assignee</th>
                            <th className="py-3 px-4">Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-xs text-[#555566] italic">
                                No tasks in this project yet. Click &quot;+ Add Task&quot; on board view to start.
                              </td>
                            </tr>
                          ) : (
                            tasks.map((task) => (
                              <tr
                                key={task.id}
                                onClick={() => setSelectedTaskId(task.id)}
                                className="border-b border-[#1C1C24] hover:bg-[#1C1C24]/30 cursor-pointer transition-colors text-xs text-[#F0ECE5]"
                              >
                                <td className="py-3 px-4 font-semibold hover:text-[#E5A320] transition-colors">
                                  {task.title}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                                      task.status === 'DONE' && 'bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20',
                                      task.status === 'IN_REVIEW' && 'bg-[#5B46F6]/10 text-[#5B46F6] border border-[#5B46F6]/20',
                                      task.status === 'IN_PROGRESS' && 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20',
                                      task.status === 'TODO' && 'bg-[#71717A]/10 text-[#71717A] border border-[#71717A]/20',
                                    )}
                                  >
                                    {task.status.replace('_', ' ')}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                                      task.priority === 'URGENT' && 'bg-[#EF4444]/10 text-[#EF4444]',
                                      task.priority === 'HIGH' && 'bg-[#F97316]/10 text-[#F97316]',
                                      task.priority === 'MEDIUM' && 'bg-[#F59E0B]/10 text-[#F59E0B]',
                                      task.priority === 'LOW' && 'bg-[#10B981]/10 text-[#10B981]',
                                    )}
                                  >
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  {task.assignees && task.assignees.length > 0 ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex -space-x-1.5">
                                        {task.assignees.slice(0, 3).map(({ user }) => (
                                          <div
                                            key={user.id}
                                            className="w-5 h-5 rounded-full bg-[#5B46F6] border border-[#14141A] flex items-center justify-center text-[7px] font-bold text-white shadow shadow-black/40 shrink-0"
                                            title={user.name || user.email}
                                          >
                                            {user.name ? getInitials(user.name) : user.email[0].toUpperCase()}
                                          </div>
                                        ))}
                                        {task.assignees.length > 3 && (
                                          <div className="w-5 h-5 rounded-full bg-[#23232C] border border-[#14141A] flex items-center justify-center text-[7px] font-bold text-[#9B9BA3] shrink-0">
                                            +{task.assignees.length - 3}
                                          </div>
                                        )}
                                      </div>
                                      <span className="text-[10px] font-medium text-[#71717A] ml-0.5">
                                        {task.assignees.length} assigned
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[#555566] italic text-[11px]">Unassigned</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  {task.dueDate ? (
                                    <span
                                      className={cn(
                                        'font-medium text-[11px]',
                                        new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                                          ? 'text-[#EF4444]'
                                          : 'text-[#9B9BA3]',
                                      )}
                                    >
                                      {new Date(task.dueDate).toLocaleDateString()}
                                    </span>
                                  ) : (
                                    <span className="text-[#555566]">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Task Detail Slide-over Panel */}
      <TaskDetailModal
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={loadProjectData}
        activeUserId={activeUserId}
        teamMembers={teamMembers}
      />

      {/* Create Task Modal */}
      {showCreateTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm"
            onClick={() => !submittingTask && setShowCreateTaskModal(false)}
          />

          <form
            onSubmit={handleCreateTask}
            className="relative w-full max-w-md bg-[#14141A] border border-[#23232C] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
              <h2 className="text-sm font-bold text-[#F0ECE5]">Create New Task</h2>
              <button
                type="button"
                onClick={() => setShowCreateTaskModal(false)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Task Title
              </label>
              <input
                type="text"
                placeholder="e.g. Implement user login flow"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                disabled={submittingTask}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                required
              />
            </div>

            {/* Task Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Description (Optional)
              </label>
              <textarea
                placeholder="Add subtasks or criteria notes..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                disabled={submittingTask}
                rows={3}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Task Priority */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Task['priority'])}
                  disabled={submittingTask}
                  className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              {/* Task Assignees */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                  Assign Team Members (Optional)
                </label>
                <div className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl p-2.5 max-h-[110px] overflow-y-auto space-y-1.5">
                  {teamMembers.map((m: TeamMember) => {
                    const isChecked = taskAssigneeIds.includes(m.user.id);
                    return (
                      <label key={m.user.id} className="flex items-center gap-2 hover:bg-[#1C1C24]/30 rounded p-1 cursor-pointer transition-colors text-xs text-[#F0ECE5]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTaskAssigneeIds([...taskAssigneeIds, m.user.id]);
                            } else {
                              setTaskAssigneeIds(taskAssigneeIds.filter(id => id !== m.user.id));
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-[#23232C] text-[#E5A320] accent-[#E5A320] cursor-pointer"
                        />
                        <span className="truncate">{m.user.name || m.user.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Task Due Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Due Date
              </label>
              <input
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                disabled={submittingTask}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[#23232C] pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowCreateTaskModal(false)}
                disabled={submittingTask}
                className="text-xs font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] px-4 py-2 hover:bg-[#1C1C24] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTask}
                className="bg-[#E5A320] hover:bg-[#F5B731] disabled:bg-[#1A1A22] text-[#0B0B0F] disabled:text-[#555566] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submittingTask ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Settings/Edit Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm"
            onClick={() => !savingSettings && setShowSettingsModal(false)}
          />

          <form
            onSubmit={handleUpdateProjectSettings}
            className="relative w-full max-w-md bg-[#14141A] border border-[#23232C] rounded-2xl p-6 shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-xs"
          >
            <div className="flex items-center justify-between border-b border-[#23232C] pb-3">
              <h2 className="text-sm font-bold text-[#F0ECE5]">Configure Project</h2>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-[#9B9BA3] hover:text-[#F0ECE5] p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={savingSettings}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320]"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Description
              </label>
              <textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                disabled={savingSettings}
                rows={3}
                className="w-full bg-[#0E0E12] border border-[#23232C] rounded-xl px-3 py-2.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
              />
            </div>

            {/* Color Accent */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#9B9BA3] uppercase tracking-wider block">
                Theme Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProjectColor(c)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all cursor-pointer hover:scale-105 active:scale-95',
                      projectColor === c ? 'border-[#F0ECE5]' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
              <div className="border-t border-[#23232C] pt-4 mt-2">
                <label className="text-[10px] font-bold text-[#EF4444] uppercase tracking-wider block mb-2">
                  Danger Zone
                </label>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={savingSettings}
                  className="w-full bg-[#EF4444]/10 hover:bg-[#EF4444] hover:text-[#0B0B0F] border border-[#EF4444]/20 text-[#EF4444] font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" /> Delete Project
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-[#23232C] pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                disabled={savingSettings}
                className="text-xs font-semibold text-[#9B9BA3] hover:text-[#F0ECE5] px-4 py-2 hover:bg-[#1C1C24] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-[#E5A320] hover:bg-[#F5B731] disabled:bg-[#1A1A22] text-[#0B0B0F] disabled:text-[#555566] font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-1.5"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
