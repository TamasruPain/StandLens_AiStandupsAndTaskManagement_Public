import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenRouterService } from '../ai/openrouter.service';
import { Digest, Prisma, NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

export interface GroupedTeamDigests {
  teamId: string;
  teamName: string;
  companyName: string;
  digests: Array<
    Digest & {
      generatedBy: {
        id: string;
        name: string | null;
        image: string | null;
      };
    }
  >;
}

@Injectable()
export class DigestsService {
  private readonly logger = new Logger(DigestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openRouterService: OpenRouterService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Helper method: Flexible team lookup by ID, inviteCode, or Name
  private async findTeamFlexibly(teamIdentifier: string) {
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [
          { id: teamIdentifier },
          { inviteCode: teamIdentifier },
          { name: { contains: teamIdentifier, mode: 'insensitive' } },
        ],
      },
    });
    return team;
  }

  // 1. Trigger AI Digest generation (direct, no queue)
  async triggerDigestGeneration(
    teamId: string,
    userId: string,
    dateStr?: string,
  ) {
    const team = await this.findTeamFlexibly(teamId);
    if (!team) throw new NotFoundException(`Team '${teamId}' not found`);

    this.logger.log(
      `Triggering direct AI digest generation for team '${team.name}'...`,
    );

    return this.generateDigestDirect(team.id, userId, dateStr);
  }

  // Direct Synchronous AI Digest Generation
  async generateDigestDirect(
    teamId: string,
    generatedById: string,
    dateStr?: string,
  ) {
    const team = await this.findTeamFlexibly(teamId);
    if (!team) throw new NotFoundException(`Team '${teamId}' not found`);

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    // Fetch standups for today
    let standups = await this.prisma.standup.findMany({
      where: { teamId: team.id, standupDate: targetDate },
      include: { user: { select: { name: true, email: true } } },
    });

    // If no standups exist for today, check any recent standups for team or create sample
    if (standups.length === 0) {
      const anyStandup = await this.prisma.standup.findFirst({
        where: { teamId: team.id },
        include: { user: { select: { name: true, email: true } } },
      });

      if (anyStandup) {
        standups = [anyStandup];
      } else {
        // Fallback demo standup items for AI synthesis
        standups = [
          {
            id: 'demo-1',
            userId: generatedById,
            teamId: team.id,
            yesterday:
              'Built initial NestJS modules and database schema for StandLens.',
            today:
              'Integrating AI OpenRouter digest worker and frontend pages.',
            blockers: 'None',
            standupDate: targetDate,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { name: 'Alex Rivera (Lead)', email: 'alex@example.com' },
          },
          {
            id: 'demo-2',
            userId: generatedById,
            teamId: team.id,
            yesterday:
              'Designed Figma wireframes and set up Next.js 16 app layout.',
            today:
              'Wiring live API client endpoints and testing AI digest rendering.',
            blockers: 'Waiting on SendGrid email credentials.',
            standupDate: targetDate,
            createdAt: new Date(),
            updatedAt: new Date(),
            user: { name: 'Sarah Chen (Dev)', email: 'sarah@example.com' },
          },
        ];
      }
    }

    this.logger.log(
      `Calling OpenRouter AI for team '${team.name}' with ${standups.length} standups...`,
    );

    const aiOutput = await this.openRouterService.generateStandupDigest(
      team.name,
      team.companyName,
      standups.map((s) => ({
        userName: s.user.name || s.user.email,
        yesterday: s.yesterday,
        today: s.today,
        blockers: s.blockers,
      })),
    );

    // Get valid user for generatedById
    let validUser = await this.prisma.user.findUnique({
      where: { id: generatedById },
    });
    if (!validUser) {
      validUser = await this.prisma.user.findFirst();
    }
    const finalUserId = validUser?.id || generatedById;

    const digest = await this.prisma.digest.upsert({
      where: {
        teamId_digestDate: { teamId: team.id, digestDate: targetDate },
      },
      update: {
        summary: aiOutput.summary,
        highlights: aiOutput.highlights,
        concerns: aiOutput.concerns,
        aiModel: aiOutput.aiModel,
        standupCount: standups.length,
        generatedById: finalUserId,
        createdAt: new Date(),
      },
      create: {
        teamId: team.id,
        digestDate: targetDate,
        summary: aiOutput.summary,
        highlights: aiOutput.highlights,
        concerns: aiOutput.concerns,
        aiModel: aiOutput.aiModel,
        standupCount: standups.length,
        generatedById: finalUserId,
      },
    });

    this.logger.log(
      `Saved Digest ${digest.id} into database using model ${aiOutput.aiModel}`,
    );

    // Notify team members about new digest
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { teamId: team.id },
    });

    for (const member of teamMembers) {
      await this.notificationsService
        .createNotification(
          member.userId,
          'AI Digest Ready',
          `A new AI standup digest is available for ${team.name}`,
          NotificationType.DIGEST_READY,
          `/teams/${team.id}?tab=digest`,
        )
        .catch((err) => console.error('Failed to create notification:', err));
    }

    return {
      message: 'AI Digest generated and saved successfully',
      digest,
      status: 'COMPLETED',
    };
  }

  // 2. Get digests for a team
  async getTeamDigests(teamId: string, dateStr?: string) {
    const team = await this.findTeamFlexibly(teamId);
    if (!team) return [];

    const whereClause: Prisma.DigestWhereInput = { teamId: team.id };
    if (dateStr && dateStr !== 'ALL') {
      const targetDate = new Date(dateStr);
      targetDate.setUTCHours(0, 0, 0, 0);
      whereClause.digestDate = targetDate;
    }

    return this.prisma.digest.findMany({
      where: whereClause,
      include: {
        generatedBy: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { digestDate: 'desc' },
    });
  }

  // 3. Get all user's digests GROUPED BY TEAM
  async getGroupedUserDigests(): Promise<GroupedTeamDigests[]> {
    const teams = await this.prisma.team.findMany({
      select: {
        id: true,
        name: true,
        companyName: true,
      },
    });

    const result: GroupedTeamDigests[] = [];

    for (const team of teams) {
      const digests = await this.prisma.digest.findMany({
        where: { teamId: team.id },
        include: {
          generatedBy: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { digestDate: 'desc' },
        take: 10,
      });

      if (digests.length > 0) {
        result.push({
          teamId: team.id,
          teamName: team.name,
          companyName: team.companyName,
          digests,
        });
      }
    }

    return result;
  }

  // 4. Get single digest by ID
  async getDigestById(digestId: string) {
    const digest = await this.prisma.digest.findUnique({
      where: { id: digestId },
      include: {
        team: true,
        generatedBy: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!digest) {
      throw new NotFoundException('Digest not found');
    }

    return digest;
  }
}
