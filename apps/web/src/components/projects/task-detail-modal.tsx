'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, Send, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface TeamMember {
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  role: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  completionDesc?: string | null;
  assignees?: {
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }[];
  comments?: Comment[];
  subtasks?: {
    id: string;
    title: string;
    isDone: boolean;
  }[];
  activities?: {
    id: string;
    action: string;
    details: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }[];
  project?: {
    id: string;
    name: string;
    teamId: string;
  };
  projectId?: string;
}

interface TaskDetailModalProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  activeUserId: string;
  teamMembers?: TeamMember[];
}

const EMPTY_ARRAY: TeamMember[] = [];

export function TaskDetailModal({
  taskId,
  isOpen,
  onClose,
  onUpdate,
  activeUserId,
  teamMembers = EMPTY_ARRAY,
}: TaskDetailModalProps) {
  const toast = useToast();
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit fields state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'>('TODO');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [dueDate, setDueDate] = useState<string>('');

  // Approval/Submission states
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Comment state
  const [commentContent, setCommentContent] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Subtask & Workload states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [memberWorkloads, setMemberWorkloads] = useState<Record<string, number>>({});
  const [rightTab, setRightTab] = useState<'comments' | 'activity'>('comments');
  const [apiTeamMembers, setApiTeamMembers] = useState<TeamMember[]>([]);

  const localTeamMembers = (teamMembers && teamMembers.length > 0) ? teamMembers : apiTeamMembers;

  const fetchTaskDetails = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const rawData = await apiClient.getTaskDetails(activeUserId, taskId);
      const data = rawData as unknown as TaskData;
      setTask(data);
      setTitle(data.title as string);
      setDescription((data.description as string) || '');
      setStatus(data.status as 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE');
      setPriority(data.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT');
      const ids = data.assignees?.map(a => a.userId) || [];
      setAssigneeIds(ids);
      setDueDate(data.dueDate ? new Date(data.dueDate as string).toISOString().split('T')[0] : '');

      // Load member workloads
      const teamId = data.project?.teamId;
      if (teamId) {
        const workloads = await apiClient.getTeamWorkload(activeUserId, teamId);
        setMemberWorkloads(workloads);

        // Load team members if not passed by prop
        if (!teamMembers || teamMembers.length === 0) {
          const projDetails = await apiClient.getProjectDetails(activeUserId, data.projectId as string);
          const members = (projDetails.team as { members: TeamMember[] })?.members || [];
          setApiTeamMembers(members);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to load task details', msg);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [taskId, activeUserId, toast, onClose, teamMembers]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && taskId) {
      timer = setTimeout(() => {
        void fetchTaskDetails();
      }, 0);
      
      // Expose globally so parent can trigger refresh when SSE comment notification fires
      (window as unknown as { refreshOpenTaskDetails?: () => void }).refreshOpenTaskDetails = () => {
        void fetchTaskDetails();
      };
    }
    return () => {
      if (timer) clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>).refreshOpenTaskDetails;
    };
  }, [isOpen, taskId, fetchTaskDetails]);

  const handleUpdateField = async (updatedFields: Record<string, unknown>) => {
    if (!taskId) return;
    try {
      setSaving(true);
      await apiClient.updateTask(activeUserId, taskId, updatedFields);
      // Refresh local details and trigger parent reload
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update task', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId || !window.confirm('Are you sure you want to delete this task?')) return;
    try {
      setSaving(true);
      await apiClient.deleteTask(activeUserId, taskId);
      toast.success('Task deleted successfully');
      onUpdate();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to delete task', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !commentContent.trim()) return;

    try {
      setSubmittingComment(true);
      const newComment = await apiClient.addTaskComment(activeUserId, taskId, {
        content: commentContent,
      });
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), newComment as unknown as Comment],
        };
      });
      setCommentContent('');
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to add comment', msg);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !newSubtaskTitle.trim()) return;

    try {
      setCreatingSubtask(true);
      const created = await apiClient.createSubtask(activeUserId, taskId, newSubtaskTitle.trim());
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          subtasks: [...(prev.subtasks || []), created as { id: string; title: string; isDone: boolean }],
        };
      });
      setNewSubtaskTitle('');
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to create subtask', msg);
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, isDone: boolean) => {
    if (!taskId) return;
    try {
      await apiClient.toggleSubtask(activeUserId, taskId, subtaskId, isDone);
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).map((s) =>
            s.id === subtaskId ? { ...s, isDone } : s
          ),
        };
      });
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to update subtask', msg);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    if (!taskId) return;
    try {
      await apiClient.deleteSubtask(activeUserId, taskId, subtaskId);
      setTask((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).filter((s) => s.id !== subtaskId),
        };
      });
      onUpdate();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Failed to delete subtask', msg);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const activeMember = localTeamMembers.find((m) => m.userId === activeUserId);
  const isLeader = !!(activeMember && (activeMember.role === 'OWNER' || activeMember.role === 'ADMIN'));
  const isOwner = !!(activeMember && activeMember.role === 'OWNER');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#000000]/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-lg h-full bg-[#0F0F14] border-l border-[#1F1F26] flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-[#1F1F26] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#14141A] border border-[#23232C] hover:bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ← Back
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isLeader && (
              <button
                onClick={async () => {
                  if (isEditing) {
                    await handleUpdateField({
                      title,
                      description,
                      status,
                      priority,
                      dueDate: dueDate || null,
                      assigneeIds,
                    });
                  }
                  setIsEditing(!isEditing);
                }}
                disabled={saving}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  isEditing 
                    ? "bg-[#10B981] hover:bg-[#10B981]/90 text-white" 
                    : "bg-[#5B46F6] hover:bg-[#5B46F6]/90 text-white"
                )}
              >
                {isEditing ? 'Save' : 'Edit'}
              </button>
            )}
            {isOwner && (
              <button
                onClick={handleDeleteTask}
                disabled={saving}
                className="p-2 text-[#F87171]/80 hover:text-[#F87171] hover:bg-[#F87171]/10 rounded-lg transition-colors cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#E5A320] animate-spin" />
          </div>
        ) : (
          task && (
            <div className="flex-1 flex flex-col overflow-y-auto">
              
              {/* Form Content */}
              <div className="p-6 space-y-6 border-b border-[#1F1F26]">
                
                {/* Review status card */}
                {task.status === 'IN_REVIEW' && (
                  <div className="bg-[#E5A320]/10 border border-[#E5A320]/20 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#E5A320] flex items-center gap-1.5 uppercase tracking-wider">
                        ⚠️ Pending Review Approval
                      </span>
                    </div>

                    {task.completionDesc && (
                      <div className="bg-[#14141A] rounded-lg p-3 border border-[#23232C]">
                        <span className="text-[10px] font-bold text-[#555566] uppercase block mb-1">
                          Completion Notes
                        </span>
                        <p className="text-xs text-[#F0ECE5] italic">
                          &quot;{task.completionDesc}&quot;
                        </p>
                      </div>
                    )}

                    {isLeader ? (
                      <div className="space-y-3 pt-2">
                        <textarea
                          placeholder="Feedback/Rejection comments (Optional)..."
                          value={feedbackNotes}
                          onChange={(e) => setFeedbackNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
                        />
                        <div className="flex gap-2.5">
                          <button
                            type="button"
                            disabled={isApproving}
                            onClick={async () => {
                              try {
                                setIsApproving(true);
                                await handleUpdateField({ status: 'DONE' });
                                toast.success('Task approved and completed!');
                              } finally {
                                setIsApproving(false);
                              }
                            }}
                            className="flex-1 bg-[#10B981] hover:bg-[#10B981]/90 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer text-center"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={isApproving}
                            onClick={async () => {
                              try {
                                setIsApproving(true);
                                await handleUpdateField({
                                  status: 'IN_PROGRESS',
                                  completionDesc: feedbackNotes || 'Changes requested.',
                                });
                                toast.success('Changes requested. Task returned to In Progress.');
                                setFeedbackNotes('');
                              } finally {
                                setIsApproving(false);
                              }
                            }}
                            className="flex-1 bg-[#EF4444] hover:bg-[#EF4444]/90 text-white rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer text-center"
                          >
                            Request Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-[#9B9BA3] leading-relaxed">
                        Your completion notes have been submitted. A team leader (Owner/Admin) will review this task shortly.
                      </div>
                    )}
                  </div>
                )}

                {/* Subtasks Section */}
                <div className="space-y-3.5 border-t border-[#1F1F26] pt-4 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block">
                      Subtasks Checklist
                    </span>
                    {task.subtasks && task.subtasks.length > 0 && (
                      <span className="text-[10px] text-[#9B9BA3] font-semibold">
                        {task.subtasks.filter(s => s.isDone).length}/{task.subtasks.length} Completed
                      </span>
                    )}
                  </div>

                  {/* Subtasks List */}
                  <div className="space-y-2">
                    {!task.subtasks || task.subtasks.length === 0 ? (
                      <p className="text-xs text-[#555566] italic">No subtasks created for this task.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {task.subtasks.map((s) => (
                          <div key={s.id} className="flex items-center justify-between gap-3 p-2 bg-[#14141A]/30 border border-[#23232C]/40 rounded-xl hover:bg-[#1C1C24]/20 transition-all group">
                            <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={s.isDone}
                                onChange={(e) => handleToggleSubtask(s.id, e.target.checked)}
                                className="w-4 h-4 rounded border-[#23232C] text-[#E5A320] accent-[#E5A320] cursor-pointer"
                              />
                              <span className={cn(
                                "text-xs transition-all truncate",
                                s.isDone ? "line-through text-[#555566]" : "text-[#F0ECE5]"
                              )}>
                                {s.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubtask(s.id)}
                              className="text-[#555566] hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-all p-1 cursor-pointer"
                              title="Delete subtask"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Subtask Form */}
                    <form onSubmit={handleCreateSubtask} className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newSubtaskTitle}
                        onChange={(e) => setNewSubtaskTitle(e.target.value)}
                        placeholder="Add new subtask..."
                        disabled={creatingSubtask}
                        className="flex-1 bg-[#14141A] border border-[#23232C] rounded-xl px-3 py-1.5 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={creatingSubtask || !newSubtaskTitle.trim()}
                        className="bg-[#1C1C24] hover:bg-[#E5A320] text-[#9B9BA3] hover:text-black border border-[#23232C] rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        {creatingSubtask ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          'Add'
                        )}
                      </button>
                    </form>
                  </div>
                </div>

                {isEditing ? (
                  <>
                    {/* Title Input */}
                    <div>
                      <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                        Task Title
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors font-semibold"
                      />
                    </div>

                    {/* Description Input */}
                    <div>
                      <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add task description or criteria..."
                        rows={4}
                        className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-sm text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors placeholder-[#555566] resize-none"
                      />
                    </div>

                    {/* Status & Priority Select */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                          Status
                        </label>
                        <select
                          value={status}
                          onChange={(e) => {
                            const newStatus = e.target.value as 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
                            if (newStatus === 'DONE' && !isLeader) {
                              toast.error('Only team leaders can mark tasks as Done. Please use the Submit Completion flow.');
                              return;
                            }
                            setStatus(newStatus);
                          }}
                          className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                        >
                          <option value="TODO">To Do</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="IN_REVIEW">In Review</option>
                          <option value="DONE">Completed</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                          Priority
                        </label>
                        <select
                          value={priority}
                          onChange={(e) => {
                            const newPriority = e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
                            setPriority(newPriority);
                          }}
                          className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>
                    </div>

                    {/* Assignees and Due Date Checkboxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                          Assign / Remove Members
                        </label>
                        <div className="bg-[#14141A] border border-[#23232C] rounded-lg p-2.5 max-h-[140px] overflow-y-auto space-y-1.5">
                          {localTeamMembers.map((member) => {
                            const workload = memberWorkloads[member.user.id] || 0;
                            const isAssigned = assigneeIds.includes(member.user.id);
                            return (
                              <label key={member.user.id} className="flex items-center justify-between gap-2 p-1 hover:bg-[#1C1C24]/30 rounded cursor-pointer transition-colors text-xs text-[#F0ECE5]">
                                <div className="flex items-center gap-2 truncate">
                                  <input
                                    type="checkbox"
                                    checked={isAssigned}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAssigneeIds([...assigneeIds, member.user.id]);
                                      } else {
                                        setAssigneeIds(assigneeIds.filter(id => id !== member.user.id));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded border-[#23232C] text-[#E5A320] accent-[#E5A320] cursor-pointer"
                                  />
                                  <span className="truncate">{member.user.name || member.user.email}</span>
                                </div>
                                <span className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0",
                                  workload === 0 ? "bg-[#10B981]/10 text-[#10B981]" :
                                  workload < 3 ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
                                  "bg-[#EF4444]/10 text-[#EF4444]"
                                )}>
                                  {workload} active
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-[#555566] uppercase tracking-wider block mb-1.5">
                          Due Date
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] cursor-pointer"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* View Mode Title */}
                    <div>
                      <h2 className="text-base font-bold text-[#F0ECE5] leading-snug">{title}</h2>
                    </div>

                    {/* View Mode Description */}
                    <div className="bg-[#14141A]/50 border border-[#23232C]/40 rounded-xl p-3.5">
                      <span className="text-[9px] font-bold text-[#555566] uppercase tracking-wider block mb-1">
                        Description
                      </span>
                      <p className="text-xs text-[#9B9BA3] leading-relaxed whitespace-pre-wrap">
                        {description || 'No description provided.'}
                      </p>
                    </div>

                    {/* View Mode Grid */}
                    <div className="grid grid-cols-3 gap-3 text-xs bg-[#14141A]/20 p-3 rounded-xl border border-[#23232C]/40">
                      <div>
                        <span className="text-[9px] font-bold text-[#555566] uppercase block mb-0.5">Status</span>
                        <span className="font-semibold text-[#F0ECE5]">{status}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-[#555566] uppercase block mb-0.5">Priority</span>
                        <span className="font-semibold text-[#F0ECE5]">{priority}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-[#555566] uppercase block mb-0.5">Due Date</span>
                        <span className="font-semibold text-[#F0ECE5]">{dueDate || 'No due date'}</span>
                      </div>
                    </div>

                    {/* View Mode Assignees List */}
                    <div>
                      <span className="text-[9px] font-bold text-[#555566] uppercase tracking-wider block mb-2">
                        Assigned Persons
                      </span>
                      {task.assignees && task.assignees.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {task.assignees.map(({ user }) => (
                            <div key={user.id} className="flex items-center gap-2 p-2 bg-[#14141A]/40 border border-[#23232C]/40 rounded-xl">
                              <div className="w-6 h-6 rounded-full bg-[#5B46F6]/15 border border-[#5B46F6]/30 flex items-center justify-center text-[9px] font-bold text-[#8B5CF6]">
                                {user.name ? getInitials(user.name) : user.email[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#F0ECE5] truncate">{user.name || 'Unassigned'}</p>
                                <p className="text-[10px] text-[#555566] truncate">{user.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#555566] italic">No members assigned to this task.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Submit Completion Section */}
                {task.status !== 'DONE' && task.status !== 'IN_REVIEW' && (
                  <div className="bg-[#1C1C24]/30 border border-[#23232C]/80 rounded-xl p-4 mt-2">
                    {!showSubmitConfirm ? (
                      <div className="flex justify-between items-center">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-[#F0ECE5]">Finished working?</h4>
                          <p className="text-[10px] text-[#9B9BA3]">Submit task completion for leader review.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSubmitConfirm(true)}
                          className="bg-[#E5A320] hover:bg-[#E5A320]/90 text-[#000] rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Submit Completion
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-[#E5A320]">Submit Completion Notes</h4>
                          <button
                            type="button"
                            onClick={() => setShowSubmitConfirm(false)}
                            className="text-[10px] text-[#9B9BA3] hover:text-[#F0ECE5]"
                          >
                            Cancel
                          </button>
                        </div>
                        <textarea
                          placeholder="Describe what you did (optional)..."
                          value={submissionNotes}
                          onChange={(e) => setSubmissionNotes(e.target.value)}
                          rows={2}
                          className="w-full bg-[#14141A] border border-[#23232C] rounded-lg px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] resize-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await handleUpdateField({
                              status: 'IN_REVIEW',
                              completionDesc: submissionNotes || null,
                            });
                            toast.success('Task submitted for review!');
                            setShowSubmitConfirm(false);
                            setSubmissionNotes('');
                          }}
                          className="w-full bg-[#E5A320] hover:bg-[#E5A320]/90 text-[#000] rounded-lg py-2 text-xs font-bold transition-colors cursor-pointer text-center"
                        >
                          Submit to Leaders
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tab Selector & Right Content Pane */}
              <div className="flex-1 flex flex-col p-6 space-y-4">
                {/* Tabs Header */}
                <div className="flex border-b border-[#1F1F26] gap-4">
                  <button
                    type="button"
                    onClick={() => setRightTab('comments')}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                      rightTab === 'comments'
                        ? "border-[#E5A320] text-[#E5A320]"
                        : "border-transparent text-[#555566] hover:text-[#9B9BA3]"
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comments ({task.comments?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('activity')}
                    className={cn(
                      "pb-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5",
                      rightTab === 'activity'
                        ? "border-[#E5A320] text-[#E5A320]"
                        : "border-transparent text-[#555566] hover:text-[#9B9BA3]"
                    )}
                  >
                    <span className="text-[10px]">📋</span>
                    Activity Log ({task.activities?.length || 0})
                  </button>
                </div>

                {rightTab === 'comments' ? (
                  <>
                    <div className="flex-1 overflow-y-auto space-y-4 max-h-[250px] pr-2">
                      {!task.comments || task.comments.length === 0 ? (
                        <p className="text-xs text-[#555566] italic text-center py-6">
                          No comments yet. Start the conversation!
                        </p>
                      ) : (
                        task.comments.map((comment: Comment) => (
                          <div key={comment.id} className="flex items-start gap-2.5 bg-[#14141A]/50 border border-[#1C1C24] p-3 rounded-xl">
                            <div className="w-7 h-7 rounded-full bg-[#5B46F6] text-[#F0ECE5] font-bold text-[9px] flex items-center justify-center shrink-0 shadow-inner">
                              {comment.user.name ? getInitials(comment.user.name) : comment.user.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-[#F0ECE5]">
                                  {comment.user.name || 'Member'}
                                </span>
                                <span className="text-[9px] text-[#555566]">
                                  {new Date(comment.createdAt).toLocaleDateString()} · {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-xs text-[#9B9BA3] leading-relaxed break-words">
                                {comment.content}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Comment Input */}
                    <form onSubmit={handleAddComment} className="flex items-center gap-2 border-t border-[#1F1F26] pt-4 mt-auto">
                      <input
                        type="text"
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Write a comment..."
                        disabled={submittingComment}
                        className="flex-1 bg-[#14141A] border border-[#23232C] rounded-xl px-3 py-2 text-xs text-[#F0ECE5] focus:outline-none focus:border-[#E5A320] transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={submittingComment || !commentContent.trim()}
                        className="bg-[#E5A320] hover:bg-[#F5B731] disabled:bg-[#1A1A22] text-[#0B0B0F] disabled:text-[#555566] p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      >
                        {submittingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[310px] pr-2">
                    {!task.activities || task.activities.length === 0 ? (
                      <p className="text-xs text-[#555566] italic text-center py-6">
                        No activity recorded yet.
                      </p>
                    ) : (
                      task.activities.map((act) => {
                        let badgeColor = 'text-[#71717A] bg-[#71717A]/10 border-[#71717A]/20';
                        let actionLabel = act.action;
                        if (act.action === 'CREATED') {
                          badgeColor = 'text-[#10B981] bg-[#10B981]/10 border-[#10B981]/20';
                          actionLabel = 'Created';
                        } else if (act.action === 'COMPLETION_SUBMITTED') {
                          badgeColor = 'text-[#E5A320] bg-[#E5A320]/10 border-[#E5A320]/20';
                          actionLabel = 'Submitted';
                        } else if (act.action === 'COMPLETION_APPROVED') {
                          badgeColor = 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30';
                          actionLabel = 'Approved';
                        } else if (act.action === 'CHANGES_REQUESTED') {
                          badgeColor = 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20';
                          actionLabel = 'Changes Requested';
                        } else if (act.action === 'COMMENT_ADDED') {
                          badgeColor = 'text-[#06B6D4] bg-[#06B6D4]/10 border-[#06B6D4]/20';
                          actionLabel = 'Commented';
                        } else if (act.action === 'SUBTASK_CREATED' || act.action === 'SUBTASK_TOGGLED' || act.action === 'SUBTASK_DELETED') {
                          badgeColor = 'text-[#8B5CF6] bg-[#8B5CF6]/10 border-[#8B5CF6]/20';
                          actionLabel = 'Checklist';
                        }

                        return (
                          <div key={act.id} className="flex items-start gap-2 text-xs border-b border-[#1F1F26] pb-3 last:border-0 last:pb-0">
                            <div className="w-5 h-5 rounded-full bg-[#1C1C24] text-[8px] font-bold flex items-center justify-center text-[#9B9BA3] shrink-0">
                              {act.user?.name ? getInitials(act.user.name) : act.user?.email[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className="font-bold text-[#F0ECE5]">
                                  {act.user?.name || act.user?.email}
                                </span>
                                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold border", badgeColor)}>
                                  {actionLabel}
                                </span>
                                <span className="text-[9px] text-[#555566] ml-auto">
                                  {new Date(act.createdAt).toLocaleDateString()} · {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {act.details && (
                                <p className="text-[11px] text-[#9B9BA3] italic mt-0.5 leading-relaxed bg-[#14141A]/60 p-2 rounded-lg border border-[#23232C]/30 whitespace-pre-wrap break-words">
                                  &quot;{act.details}&quot;
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>
          )
        )}
      </div>
    </div>
  );
}
