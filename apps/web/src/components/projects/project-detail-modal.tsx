'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, ArrowRight, BarChart2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
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

interface TaskItem {
  id: string;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string | null;
  assignees: {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }[];
  subtasks?: {
    id: string;
    title: string;
    isDone: boolean;
  }[];
}

interface ProjectDetailModalProps {
  projectId: string | null;
  isOpen: boolean;
  onClose: () => void;
  activeUserId: string;
  onTaskClick?: (taskId: string) => void;
}

export function ProjectDetailModal({
  projectId,
  isOpen,
  onClose,
  activeUserId,
  onTaskClick,
}: ProjectDetailModalProps) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setLoading(true);
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    try {
      const [projRes, tasksRes] = await Promise.all([
        apiClient.getProjectDetails(activeUserId, projectId),
        apiClient.getTasks(activeUserId, projectId),
      ]);
      setProject(projRes as unknown as ProjectData);
      setTasks(tasksRes as unknown as TaskItem[]);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeUserId]);

  useEffect(() => {
    if (isOpen && projectId) {
      const timer = setTimeout(() => {
        void fetchProjectDetails();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, projectId, fetchProjectDetails]);

  if (!isOpen) return null;

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const getPriorityColor = (priority: TaskItem['priority']) => {
    switch (priority) {
      case 'URGENT': return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
      case 'HIGH': return 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20';
      case 'MEDIUM': return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20';
      default: return 'bg-[#71717A]/10 text-[#71717A] border-[#71717A]/20';
    }
  };

  const getStatusColor = (status: TaskItem['status']) => {
    switch (status) {
      case 'DONE': return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
      case 'IN_REVIEW': return 'bg-[#E5A320]/10 text-[#E5A320] border-[#E5A320]/20';
      case 'IN_PROGRESS': return 'bg-[#5B46F6]/10 text-[#5B46F6] border-[#5B46F6]/20';
      default: return 'bg-[#71717A]/10 text-[#71717A] border-[#71717A]/20';
    }
  };

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
            <span className="text-xs text-[#9B9BA3] font-bold uppercase tracking-wider pl-2">
              Project Overview
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#1C1C24] text-[#9B9BA3] hover:text-[#F0ECE5] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#E5A320] animate-spin" />
          </div>
        ) : (
          project && (
            <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
              {/* Project Card Info */}
              <div className="bg-[#14141A]/50 border border-[#23232C] rounded-2xl p-5 relative overflow-hidden">
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: project.color || '#5B46F6' }}
                />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase text-[#9B9BA3] tracking-wide bg-[#1C1C24] px-2 py-0.5 rounded border border-[#23232C]">
                      {project.team?.name}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#F0ECE5]">{project.name}</h3>
                  <p className="text-xs text-[#9B9BA3] leading-relaxed">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2 mt-5 pt-4 border-t border-[#23232C]/40">
                  <div className="flex justify-between items-center text-[10px] text-[#71717A] font-semibold">
                    <span className="flex items-center gap-1">
                      <BarChart2 className="w-3 h-3 text-[#E5A320]" />
                      {doneTasks}/{totalTasks} Tasks Complete
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1C1C24] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300 bg-[#E5A320]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#F0ECE5] uppercase tracking-wider">
                  Roadmap / Tasks ({totalTasks})
                </h4>

                {totalTasks === 0 ? (
                  <p className="text-xs text-[#71717A] italic">No tasks created in this project yet.</p>
                ) : (
                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                    {tasks.map((task) => {
                      const taskProgressPercent = (() => {
                        if (task.subtasks && task.subtasks.length > 0) {
                          const completed = task.subtasks.filter((s) => s.isDone).length;
                          return Math.round((completed / task.subtasks.length) * 100);
                        }
                        return task.status === 'DONE' ? 100 : task.status === 'IN_REVIEW' ? 80 : task.status === 'IN_PROGRESS' ? 50 : 0;
                      })();

                      return (
                        <div
                          key={task.id}
                          onClick={() => onTaskClick?.(task.id)}
                          className={cn(
                            "bg-[#14141A]/30 border border-[#23232C]/80 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all hover:bg-[#1C1C24]/10",
                            onTaskClick ? "cursor-pointer hover:border-[#383846]" : ""
                          )}
                        >
                          <div className="flex justify-between items-start gap-4">
                            <h5 className="text-xs font-semibold text-[#F0ECE5] line-clamp-1">
                              {task.title}
                            </h5>
                            <div className="flex gap-1.5 shrink-0">
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase", getPriorityColor(task.priority))}>
                                {task.priority}
                              </span>
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase", getStatusColor(task.status))}>
                                {task.status}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-[#23232C]/40 pt-2 text-[10px] text-[#71717A]">
                            <span>
                              {task.subtasks && task.subtasks.length > 0
                                ? `${task.subtasks.filter((s) => s.isDone).length}/${task.subtasks.length} subtasks`
                                : `Progress: ${taskProgressPercent}%`}
                            </span>
                            {onTaskClick && (
                              <span className="text-[9px] text-[#E5A320] font-bold flex items-center gap-0.5 group">
                                View <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
