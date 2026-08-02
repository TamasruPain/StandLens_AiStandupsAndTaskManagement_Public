import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';
import { TeamRole } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper method: Flexible team ID lookup
  private async getRealTeamId(teamIdentifier: string): Promise<string> {
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [
          { id: teamIdentifier },
          { inviteCode: teamIdentifier },
          { name: { contains: teamIdentifier, mode: 'insensitive' } },
        ],
      },
    });
    if (!team)
      throw new NotFoundException(`Team '${teamIdentifier}' not found`);
    return team.id;
  }

  private generateInviteCode(name: string): string {
    const prefix =
      name
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 4)
        .toUpperCase() || 'TEAM';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${rand}`;
  }

  // 1. Create a new team (Caller automatically becomes Team OWNER)
  async createTeam(userId: string, dto: CreateTeamDto) {
    const inviteCode = this.generateInviteCode(dto.name);
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        companyName: dto.companyName,
        inviteCode: inviteCode,
        discoverable: dto.discoverable ?? true,
        members: {
          create: {
            userId: userId,
            role: TeamRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return team;
  }

  // 2. Get all teams for a user (owned teams + member teams)
  async getUserTeams(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            _count: {
              select: {
                members: true,
                joinRequests: { where: { status: 'PENDING' } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Upgrade any old CUID invite codes to clean format (e.g. ACME-8F92)
    for (const m of memberships) {
      if (m.team.inviteCode && m.team.inviteCode.length > 15) {
        const newCode = this.generateInviteCode(m.team.name);
        await this.prisma.team.update({
          where: { id: m.team.id },
          data: { inviteCode: newCode },
        });
        m.team.inviteCode = newCode;
      }
    }

    const ownedTeams = memberships
      .filter((m) => m.role === TeamRole.OWNER)
      .map((m) => ({ ...m.team, myRole: m.role }));

    const memberTeams = memberships
      .filter((m) => m.role !== TeamRole.OWNER)
      .map((m) => ({ ...m.team, myRole: m.role }));

    // Get team IDs where the user is OWNER or ADMIN to show incoming requests
    const adminOrOwnedTeamIds = memberships
      .filter((m) => m.role === TeamRole.OWNER || m.role === TeamRole.ADMIN)
      .map((m) => m.teamId);

    // Incoming requests (to be approved by this user)
    const incomingRequests = await this.prisma.joinRequest.findMany({
      where: {
        teamId: { in: adminOrOwnedTeamIds },
        status: 'PENDING',
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        team: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sent requests (sent by this user to other teams)
    const sentRequests = await this.prisma.joinRequest.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      include: {
        team: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ownedTeams,
      memberTeams,
      incomingRequests,
      sentRequests,
    };
  }

  // 3. Search public discoverable teams by name or company
  async searchTeams(query: string, userId: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const teams = await this.prisma.team.findMany({
      where: {
        discoverable: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { companyName: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
        joinRequests: {
          where: { userId, status: 'PENDING' },
          select: { id: true, status: true },
        },
      },
      take: 20,
    });

    return teams.map((team) => {
      const isMember = team.members.length > 0;
      const hasPendingRequest = team.joinRequests.length > 0;

      return {
        id: team.id,
        name: team.name,
        companyName: team.companyName,
        memberCount: team._count.members,
        createdAt: team.createdAt,
        isMember,
        myRole: isMember ? team.members[0].role : null,
        hasPendingRequest,
      };
    });
  }

  // 4. Get a single team's details
  async getTeamDetails(teamId: string, userId: string) {
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [
          { id: teamId },
          { inviteCode: teamId },
          { name: { contains: teamId, mode: 'insensitive' } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { members: true, standups: true, digests: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team '${teamId}' not found`);
    }

    if (team.inviteCode && team.inviteCode.length > 15) {
      const newCode = this.generateInviteCode(team.name);
      await this.prisma.team.update({
        where: { id: team.id },
        data: { inviteCode: newCode },
      });
      team.inviteCode = newCode;
    }

    const membership = team.members.find((m) => m.userId === userId);
    if (!membership) {
      throw new ForbiddenException(`You are not a member of this team.`);
    }
    return {
      ...team,
      myRole: membership.role,
    };
  }

  // 5. Update team settings (Only OWNER or ADMIN)
  async updateTeam(teamId: string, _userId: string, dto: UpdateTeamDto) {
    const realId = await this.getRealTeamId(teamId);

    return this.prisma.team.update({
      where: { id: realId },
      data: dto,
    });
  }

  // 6. Delete team (Only OWNER)
  async deleteTeam(teamId: string) {
    const realId = await this.getRealTeamId(teamId);

    await this.prisma.team.delete({
      where: { id: realId },
    });

    return { message: 'Team deleted successfully' };
  }
}
