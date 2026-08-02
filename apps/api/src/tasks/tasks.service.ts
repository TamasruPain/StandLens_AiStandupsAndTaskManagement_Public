import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsSseService } from '../notifications/notifications-sse.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskCommentDto,
} from './dto/task.dto';
import { NotificationType, TaskStatus, TeamRole } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly sseService: NotificationsSseService,
  ) {}

  private async logTaskActivity(
    taskId: string,
    userId: string,
    action: string,
    details?: string,
  ) {
    try {
      await this.prisma.taskActivity.create({
        data: {
          taskId,
          userId,
          action,
          details: details || null,
        },
      });
    } catch (e) {
      console.error('Failed to log task activity:', e);
    }
  }

  private async checkProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { teamId: true, name: true, id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${projectId}" not found`);
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });

    if (!member) {
      throw new ForbiddenException(
        'You are not authorized to access this project',
      );
    }

    return project;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const project = await this.checkProjectAccess(userId, dto.projectId);

    // Get maximum order within status
    const status = dto.status || TaskStatus.TODO;
    const maxOrderTask = await this.prisma.task.findFirst({
      where: { projectId: dto.projectId, status },
      orderBy: { order: 'desc' },
    });
    const nextOrder = maxOrderTask ? maxOrderTask.order + 1 : 0;

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description || null,
        status,
        priority: dto.priority || 'MEDIUM',
        createdById: userId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        order: nextOrder,
        assignees:
          dto.assigneeIds && dto.assigneeIds.length > 0
            ? {
                create: dto.assigneeIds.map((uId) => ({ userId: uId })),
              }
            : undefined,
      },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    // Notify assignees
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      for (const assigneeId of dto.assigneeIds) {
        if (assigneeId !== userId) {
          await this.notificationsService
            .createNotification(
              assigneeId,
              'Task Assigned',
              `You have been assigned to task: "${task.title}"`,
              NotificationType.TASK_ASSIGNED,
              `/projects/${project.id}`,
            )
            .catch(() => {});
        }
      }
    }

    // Broadcast SSE to other team members
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: project.teamId, userId: { not: userId } },
    });

    for (const member of teamMembers) {
      this.sseService.pushNotification(member.userId, {
        type: 'TASK_CREATED',
        projectId: project.id,
        task,
      });
    }

    await this.logTaskActivity(task.id, userId, 'CREATED', task.title);

    return task;
  }

  async getTasksForProject(userId: string, projectId: string) {
    await this.checkProjectAccess(userId, projectId);

    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
        subtasks: true,
      },
      orderBy: [{ status: 'asc' }, { order: 'asc' }],
    });
  }

  async getTaskDetails(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, teamId: true } },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        createdBy: { select: { id: true, name: true } },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    await this.checkProjectAccess(userId, task.projectId);

    return task;
  }

  async getUserAssignedTasks(userId: string) {
    return this.prisma.task.findMany({
      where: {
        assignees: {
          some: { userId },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            team: {
              select: { id: true, name: true },
            },
          },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: { select: { comments: true } },
        subtasks: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateTask(userId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true, assignees: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    await this.checkProjectAccess(userId, task.projectId);

    // Get current user's role in the team
    const userMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: { userId, teamId: task.project.teamId },
      },
    });

    const isLeader =
      userMember &&
      (userMember.role === TeamRole.OWNER ||
        userMember.role === TeamRole.ADMIN);

    let targetStatus = dto.status;

    // 1. Regular members cannot transition directly to DONE.
    // If they attempt to do so, automatically redirect it to IN_REVIEW for approval.
    if (targetStatus === TaskStatus.DONE && !isLeader) {
      targetStatus = TaskStatus.IN_REVIEW;
    }

    const oldStatus = task.status;
    const oldAssigneeIds = (task.assignees || []).map((a) => a.userId);

    // 2. Perform updates
    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description:
          dto.description !== undefined ? dto.description : undefined,
        status: targetStatus ?? undefined,
        priority: dto.priority ?? undefined,
        dueDate:
          dto.dueDate === null
            ? null
            : dto.dueDate
              ? new Date(dto.dueDate)
              : undefined,
        order: dto.order ?? undefined,
        completionDesc:
          dto.completionDesc !== undefined ? dto.completionDesc : undefined,
        assignees:
          dto.assigneeIds !== undefined
            ? {
                deleteMany: {},
                create: dto.assigneeIds.map((uId) => ({ userId: uId })),
              }
            : undefined,
      },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    const newAssigneeIds = updatedTask.assignees.map((a) => a.userId);

    // Log status transitions in task activity
    if (dto.status !== undefined && oldStatus !== targetStatus) {
      let action = 'STATUS_CHANGED';
      let details = `${oldStatus} -> ${targetStatus}`;

      if (
        targetStatus === TaskStatus.IN_REVIEW &&
        oldStatus !== TaskStatus.IN_REVIEW
      ) {
        action = 'COMPLETION_SUBMITTED';
        details = dto.completionDesc || 'Submitted task for review';
      } else if (
        targetStatus === TaskStatus.DONE &&
        oldStatus === TaskStatus.IN_REVIEW
      ) {
        action = 'COMPLETION_APPROVED';
        details = 'Task approved and completed';
      } else if (
        oldStatus === TaskStatus.IN_REVIEW &&
        targetStatus !== TaskStatus.DONE &&
        targetStatus !== TaskStatus.IN_REVIEW
      ) {
        action = 'CHANGES_REQUESTED';
        details = dto.completionDesc || 'Leader requested changes';
      }

      await this.logTaskActivity(id, userId, action, details);
    }

    // Log assignee change transitions in task activity
    if (dto.assigneeIds !== undefined) {
      const addedIds = newAssigneeIds.filter(
        (x) => !oldAssigneeIds.includes(x),
      );
      const removedIds = oldAssigneeIds.filter(
        (x) => !newAssigneeIds.includes(x),
      );

      for (const addedId of addedIds) {
        const user = await this.prisma.user.findUnique({
          where: { id: addedId },
          select: { name: true, email: true },
        });
        const name = user?.name || user?.email || addedId;
        await this.logTaskActivity(id, userId, 'ASSIGNEE_ADDED', name);
      }
      for (const removedId of removedIds) {
        const user = await this.prisma.user.findUnique({
          where: { id: removedId },
          select: { name: true, email: true },
        });
        const name = user?.name || user?.email || removedId;
        await this.logTaskActivity(id, userId, 'ASSIGNEE_REMOVED', name);
      }
    }

    // 3. Handle review/completion notification triggers
    // Case A: Task is submitted for review (MEMBER moves it to IN_REVIEW)
    if (
      targetStatus === TaskStatus.IN_REVIEW &&
      oldStatus !== TaskStatus.IN_REVIEW
    ) {
      const submitter = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      const submitterName =
        submitter?.name || submitter?.email || 'A team member';

      // Find all leaders (owners/admins) of this team to notify
      const leaders = await this.prisma.teamMember.findMany({
        where: {
          teamId: task.project.teamId,
          role: { in: [TeamRole.OWNER, TeamRole.ADMIN] },
          userId: { not: userId },
        },
      });

      for (const leader of leaders) {
        await this.notificationsService
          .createNotification(
            leader.userId,
            'Task Pending Review',
            `"${updatedTask.title}" has been submitted for review by ${submitterName}.`,
            'TASK_REVIEW_REQUESTED',
            `/projects/${task.projectId}`,
          )
          .catch(() => {});
      }
    }

    // Case B: Leader approves the task (IN_REVIEW -> DONE)
    if (
      targetStatus === TaskStatus.DONE &&
      oldStatus === TaskStatus.IN_REVIEW
    ) {
      for (const assigneeId of newAssigneeIds) {
        if (assigneeId !== userId) {
          await this.notificationsService
            .createNotification(
              assigneeId,
              'Task Approved',
              `Your completion request for "${updatedTask.title}" has been approved!`,
              'TASK_COMPLETED',
              `/projects/${task.projectId}`,
            )
            .catch(() => {});
        }
      }
    }

    // Case C: Leader requests changes / rejects task (IN_REVIEW -> IN_PROGRESS or TODO)
    if (
      oldStatus === TaskStatus.IN_REVIEW &&
      targetStatus &&
      targetStatus !== TaskStatus.IN_REVIEW &&
      targetStatus !== TaskStatus.DONE
    ) {
      for (const assigneeId of newAssigneeIds) {
        if (assigneeId !== userId) {
          await this.notificationsService
            .createNotification(
              assigneeId,
              'Changes Requested on Task',
              `Leader requested changes on: "${updatedTask.title}".`,
              NotificationType.TASK_ASSIGNED,
              `/projects/${task.projectId}`,
            )
            .catch(() => {});
        }
      }

      // Automatically post a system comment on this task if feedback is provided
      if (dto.completionDesc) {
        await this.prisma.taskComment.create({
          data: {
            taskId: updatedTask.id,
            userId,
            content: `❌ Changes Requested: ${dto.completionDesc}`,
          },
        });
      }
    }

    // Notify newly added assignees
    for (const assigneeId of newAssigneeIds) {
      if (!oldAssigneeIds.includes(assigneeId) && assigneeId !== userId) {
        await this.notificationsService
          .createNotification(
            assigneeId,
            'Task Assigned',
            `You have been assigned to task: "${updatedTask.title}"`,
            NotificationType.TASK_ASSIGNED,
            `/projects/${task.projectId}`,
          )
          .catch(() => {});
      }
    }

    // Broadcast SSE change (like status change, card moves) to team members
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: task.project.teamId, userId: { not: userId } },
    });

    for (const member of teamMembers) {
      this.sseService.pushNotification(member.userId, {
        type: 'TASK_UPDATED',
        projectId: task.projectId,
        task: updatedTask,
        oldStatus,
      });
    }

    return updatedTask;
  }

  async deleteTask(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    const member = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: task.project.teamId } },
    });

    if (!member || member.role !== TeamRole.OWNER) {
      throw new ForbiddenException(
        'Only the team owner is authorized to delete tasks',
      );
    }

    await this.prisma.task.delete({
      where: { id },
    });

    // Broadcast deletion to team members
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: task.project.teamId, userId: { not: userId } },
    });

    for (const member of teamMembers) {
      this.sseService.pushNotification(member.userId, {
        type: 'TASK_DELETED',
        projectId: task.projectId,
        taskId: id,
      });
    }

    return { message: 'Task deleted successfully' };
  }

  async addComment(userId: string, id: string, dto: CreateTaskCommentDto) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true, assignees: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID "${id}" not found`);
    }

    await this.checkProjectAccess(userId, task.projectId);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: id,
        userId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Notify assignees or creator if someone else comments
    const notifyUserIds = new Set<string>();
    const assignees = task.assignees || [];
    for (const a of assignees) {
      if (a.userId !== userId) notifyUserIds.add(a.userId);
    }
    if (task.createdById !== userId) notifyUserIds.add(task.createdById);

    for (const targetUserId of notifyUserIds) {
      await this.notificationsService
        .createNotification(
          targetUserId,
          'New Comment on Task',
          `Someone commented on task: "${task.title}"`,
          NotificationType.TASK_ASSIGNED, // Keep type standard for notifications
          `/projects/${task.projectId}`,
        )
        .catch(() => {});
    }

    // Broadcast SSE update
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: task.project.teamId, userId: { not: userId } },
    });

    for (const member of teamMembers) {
      this.sseService.pushNotification(member.userId, {
        type: 'TASK_COMMENT_ADDED',
        projectId: task.projectId,
        taskId: id,
        comment,
      });
    }

    await this.logTaskActivity(
      id,
      userId,
      'COMMENT_ADDED',
      dto.content.slice(0, 100),
    );

    return comment;
  }

  async createSubtask(userId: string, taskId: string, title: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task)
      throw new NotFoundException(`Task with ID "${taskId}" not found`);
    await this.checkProjectAccess(userId, task.projectId);

    const subtask = await this.prisma.taskSubtask.create({
      data: {
        taskId,
        title,
      },
    });

    await this.logTaskActivity(taskId, userId, 'SUBTASK_CREATED', title);

    return subtask;
  }

  async toggleSubtask(
    userId: string,
    taskId: string,
    subtaskId: string,
    isDone: boolean,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task)
      throw new NotFoundException(`Task with ID "${taskId}" not found`);
    await this.checkProjectAccess(userId, task.projectId);

    const subtask = await this.prisma.taskSubtask.update({
      where: { id: subtaskId },
      data: { isDone },
    });

    await this.logTaskActivity(
      taskId,
      userId,
      'SUBTASK_TOGGLED',
      `"${subtask.title}" marked as ${isDone ? 'completed' : 'incomplete'}`,
    );

    return subtask;
  }

  async deleteSubtask(userId: string, taskId: string, subtaskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task)
      throw new NotFoundException(`Task with ID "${taskId}" not found`);
    await this.checkProjectAccess(userId, task.projectId);

    const subtask = await this.prisma.taskSubtask.delete({
      where: { id: subtaskId },
    });

    await this.logTaskActivity(
      taskId,
      userId,
      'SUBTASK_DELETED',
      subtask.title,
    );

    return { message: 'Subtask deleted successfully' };
  }

  async getTeamMembersWorkload(userId: string, teamId: string) {
    const isMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!isMember) {
      throw new ForbiddenException(
        'You are not authorized to view this team workload',
      );
    }

    const activeTasks = await this.prisma.task.findMany({
      where: {
        project: { teamId },
        status: { not: TaskStatus.DONE },
      },
      select: {
        assignees: {
          select: { userId: true },
        },
      },
    });

    const counts: Record<string, number> = {};
    for (const t of activeTasks) {
      for (const assign of t.assignees) {
        counts[assign.userId] = (counts[assign.userId] || 0) + 1;
      }
    }

    return counts;
  }

  async getTasksPendingReviewForLeader(userId: string) {
    const leaderMemberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
        role: { in: [TeamRole.OWNER, TeamRole.ADMIN] },
      },
      select: { teamId: true },
    });

    const teamIds = leaderMemberships.map((m) => m.teamId);
    if (teamIds.length === 0) return [];

    return this.prisma.task.findMany({
      where: {
        project: { teamId: { in: teamIds } },
        status: TaskStatus.IN_REVIEW,
      },
      include: {
        project: {
          select: { id: true, name: true, color: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        subtasks: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
