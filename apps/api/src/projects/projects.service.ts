import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { TeamRole } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async checkTeamMembership(userId: string, teamId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    if (!member) {
      throw new ForbiddenException(
        'You must be a member of the team to access its projects',
      );
    }
    return member;
  }

  private async checkAdminOrOwner(userId: string, teamId: string) {
    const member = await this.checkTeamMembership(userId, teamId);
    if (member.role !== TeamRole.ADMIN && member.role !== TeamRole.OWNER) {
      throw new ForbiddenException('Admin or Owner privileges required');
    }
  }

  private async checkOwner(userId: string, teamId: string) {
    const member = await this.checkTeamMembership(userId, teamId);
    if (member.role !== TeamRole.OWNER) {
      throw new ForbiddenException('Owner privileges required');
    }
  }

  async createProject(userId: string, dto: CreateProjectDto) {
    await this.checkTeamMembership(userId, dto.teamId);

    const existingProject = await this.prisma.project.findUnique({
      where: {
        teamId_name: {
          teamId: dto.teamId,
          name: dto.name,
        },
      },
    });

    if (existingProject) {
      throw new ConflictException(
        `Project with name "${dto.name}" already exists in this team`,
      );
    }

    return this.prisma.project.create({
      data: {
        teamId: dto.teamId,
        name: dto.name,
        description: dto.description || null,
        color: dto.color || '#5B46F6',
        createdById: userId,
      },
    });
  }

  async getProjectsForTeam(userId: string, teamId: string) {
    await this.checkTeamMembership(userId, teamId);

    const projects = await this.prisma.project.findMany({
      where: { teamId, archived: false },
      include: {
        tasks: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map((project) => {
      const tasks = project.tasks;
      const todoCount = tasks.filter((t) => t.status === 'TODO').length;
      const inProgressCount = tasks.filter(
        (t) => t.status === 'IN_PROGRESS',
      ).length;
      const inReviewCount = tasks.filter(
        (t) => t.status === 'IN_REVIEW',
      ).length;
      const doneCount = tasks.filter((t) => t.status === 'DONE').length;
      const totalCount = tasks.length;
      const progressPercent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      return {
        ...project,
        todoCount,
        inProgressCount,
        inReviewCount,
        doneCount,
        totalCount,
        progressPercent,
      };
    });
  }

  async getUserProjects(userId: string) {
    // Get all projects in teams where the user is a member
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });

    const teamIds = memberships.map((m) => m.teamId);

    const projects = await this.prisma.project.findMany({
      where: {
        teamId: { in: teamIds },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        tasks: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((project) => {
      const tasks = project.tasks;
      const todoCount = tasks.filter((t) => t.status === 'TODO').length;
      const inProgressCount = tasks.filter(
        (t) => t.status === 'IN_PROGRESS',
      ).length;
      const inReviewCount = tasks.filter(
        (t) => t.status === 'IN_REVIEW',
      ).length;
      const doneCount = tasks.filter((t) => t.status === 'DONE').length;
      const totalCount = tasks.length;
      const progressPercent =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      return {
        ...project,
        todoCount,
        inProgressCount,
        inReviewCount,
        doneCount,
        totalCount,
        progressPercent,
      };
    });
  }

  async getProjectDetails(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    await this.checkTeamMembership(userId, project.teamId);

    return project;
  }

  async updateProject(userId: string, id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    await this.checkAdminOrOwner(userId, project.teamId);

    if (dto.name && dto.name !== project.name) {
      const existingProject = await this.prisma.project.findFirst({
        where: {
          teamId: project.teamId,
          name: dto.name,
          id: { not: id },
        },
      });
      if (existingProject) {
        throw new ConflictException(
          `Project with name "${dto.name}" already exists in this team`,
        );
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description:
          dto.description !== undefined ? dto.description : undefined,
        color: dto.color ?? undefined,
        archived: dto.archived ?? undefined,
      },
    });
  }

  async deleteProject(userId: string, id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID "${id}" not found`);
    }

    await this.checkOwner(userId, project.teamId);

    await this.prisma.project.delete({
      where: { id },
    });

    return { message: 'Project successfully deleted' };
  }
}
