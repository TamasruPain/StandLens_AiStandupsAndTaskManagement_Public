'use client';

import React from 'react';
import { Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string | null;
  completionDesc?: string | null;
  createdAt: string;
  updatedAt: string;
  assignees?: {
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
  _count?: {
    comments: number;
  };
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getProgressPercentage = (taskItem: Task) => {
    if (taskItem.subtasks && taskItem.subtasks.length > 0) {
      const completed = taskItem.subtasks.filter((s) => s.isDone).length;
      return Math.round((completed / taskItem.subtasks.length) * 100);
    }
    switch (taskItem.status) {
      case 'DONE': return 100;
      case 'IN_REVIEW': return 80;
      case 'IN_PROGRESS': return 50;
      default: return 0;
    }
  };

  const getProgressColor = (status: Task['status']) => {
    switch (status) {
      case 'DONE': return 'bg-[#10B981]';
      case 'IN_REVIEW': return 'bg-[#E5A320]';
      case 'IN_PROGRESS': return 'bg-[#5B46F6]';
      default: return 'bg-[#71717A]';
    }
  };

  const getPriorityStyles = (p: string) => {
    switch (p) {
      case 'URGENT':
        return 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20';
      case 'HIGH':
        return 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20';
      case 'MEDIUM':
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20';
      default:
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20';
    }
  };

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="bg-[#14141A] border border-[#23232C] hover:border-[#383846] rounded-xl p-4 cursor-grab active:cursor-grabbing hover:shadow-lg transition-all duration-200 group flex flex-col gap-3.5 select-none"
    >
      {/* Priority & Meta */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase',
            getPriorityStyles(task.priority),
          )}
        >
          {task.priority}
        </span>
        
        {isOverdue && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-[#EF4444] animate-pulse">
            <AlertCircle className="w-3 h-3" /> OVERDUE
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div>
        <h4 className="text-sm font-semibold text-[#F0ECE5] group-hover:text-[#E5A320] transition-colors line-clamp-2 leading-snug">
          {task.title}
        </h4>
        {task.description && (
          <p className="text-xs text-[#9B9BA3] mt-1.5 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full space-y-1 mt-0.5">
        <div className="flex justify-between text-[9px] text-[#71717A] uppercase font-bold tracking-wider">
          <span className="flex items-center gap-1">
            Progress
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="text-[#9B9BA3] lowercase font-semibold">
                ({task.subtasks.filter(s => s.isDone).length}/{task.subtasks.length} subtasks)
              </span>
            )}
          </span>
          <span>{getProgressPercentage(task)}%</span>
        </div>
        <div className="w-full bg-[#1C1C24] h-1 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-300", getProgressColor(task.status))}
            style={{ width: `${getProgressPercentage(task)}%` }}
          />
        </div>
      </div>

      {/* Card Footer Info */}
      <div className="flex items-center justify-between border-t border-[#1C1C24] pt-3 mt-1 text-[11px] text-[#71717A]">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <div
              className={cn(
                'flex items-center gap-1',
                isOverdue ? 'text-[#EF4444] font-medium' : 'text-[#9B9BA3]',
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDueDate(task.dueDate)}</span>
            </div>
          )}

          {task._count && task._count.comments > 0 && (
            <div className="flex items-center gap-1 text-[#9B9BA3]">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{task._count.comments}</span>
            </div>
          )}
        </div>

        {/* Assignee Avatars */}
        <div className="flex items-center gap-1.5">
          {task.assignees && task.assignees.length > 0 ? (
            <div className="flex items-center gap-1">
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
            <span className="text-[10px] text-[#555566] italic">Unassigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
