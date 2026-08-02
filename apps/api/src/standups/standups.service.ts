import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitStandupDto } from './dto/standup.dto';
import { Prisma } from '@prisma/client';
import { NotificationsSseService } from '../notifications/notifications-sse.service';

@Injectable()
export class StandupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: NotificationsSseService,
  ) {}

  // 1. Submit or update today's standup entry for a team
  async submitStandup(userId: string, dto: SubmitStandupDto) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: dto.teamId } },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a member of the team to submit a standup',
      );
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const savedStandup = await this.prisma.standup.upsert({
      where: {
        userId_teamId_standupDate: {
          userId,
          teamId: dto.teamId,
          standupDate: today,
        },
      },
      update: {
        yesterday: dto.yesterday,
        today: dto.today,
        blockers: dto.blockers || null,
        updatedAt: new Date(),
      },
      create: {
        userId,
        teamId: dto.teamId,
        yesterday: dto.yesterday,
        today: dto.today,
        blockers: dto.blockers || null,
        standupDate: today,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    // Notify other team members asynchronously about standup submission (Real-Time Popup)
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        teamId: dto.teamId,
        userId: { not: userId },
      },
    });

    for (const member of teamMembers) {
      this.sseService.pushNotification(member.userId, {
        type: 'STANDUP_SUBMITTED',
        teamId: dto.teamId,
        standup: savedStandup,
      });
    }

    return savedStandup;
  }

  // 2. Get standups for a team on a specific date (or ALL dates if dateStr === 'ALL')
  async getTeamStandups(teamId: string, userId: string, dateStr?: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a member of the team to view standups',
      );
    }

    const whereClause: Prisma.StandupWhereInput = { teamId };

    let targetDate: Date | null = null;
    if (dateStr && dateStr !== 'ALL') {
      targetDate = new Date(dateStr);
      targetDate.setUTCHours(0, 0, 0, 0);
      whereClause.standupDate = targetDate;
    } else if (!dateStr) {
      // Default to today if no date specified
      targetDate = new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
      whereClause.standupDate = targetDate;
    }

    const standups = await this.prisma.standup.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const myStandup = standups.find((s) => s.userId === userId);

    return {
      date: targetDate || 'ALL',
      submittedCount: standups.length,
      hasSubmitted: !!myStandup,
      myStandup: myStandup || null,
      standups,
    };
  }

  // 3. Get user's personal standup history across all teams or a specific team
  async getMyStandupHistory(userId: string, teamId?: string, dateStr?: string) {
    const whereClause: Prisma.StandupWhereInput = { userId };
    if (teamId) {
      whereClause.teamId = teamId;
    }
    if (dateStr && dateStr !== 'ALL') {
      const targetDate = new Date(dateStr);
      targetDate.setUTCHours(0, 0, 0, 0);
      whereClause.standupDate = targetDate;
    }

    return this.prisma.standup.findMany({
      where: whereClause,
      include: {
        team: {
          select: { id: true, name: true, companyName: true },
        },
      },
      orderBy: { standupDate: 'desc' },
    });
  }
}
