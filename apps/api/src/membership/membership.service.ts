import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JoinRequestStatus, TeamRole, NotificationType } from '@prisma/client';
import {
  UpdateJoinRequestDto,
  UpdateMemberRoleDto,
} from './dto/membership.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsSseService } from '../notifications/notifications-sse.service';

@Injectable()
export class MembershipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly sseService: NotificationsSseService,
  ) {}

  // 1. Send join request to a discoverable team
  async sendJoinRequest(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (!team.discoverable) {
      throw new ForbiddenException(
        'This team is private and does not accept public join requests',
      );
    }

    // Check if already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this team');
    }

    // Check existing request
    const existingRequest = await this.prisma.joinRequest.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (existingRequest && existingRequest.status === 'PENDING') {
      throw new ConflictException(
        'You already have a pending join request for this team',
      );
    }

    // Create or update request
    const request = await this.prisma.joinRequest.upsert({
      where: { userId_teamId: { userId, teamId } },
      update: { status: 'PENDING', createdAt: new Date(), respondedAt: null },
      create: { userId, teamId, status: 'PENDING' },
    });

    // Notify team Owners and Admins asynchronously
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const requesterName = requester?.name || requester?.email || 'Someone';

    const teamAdmins = await this.prisma.teamMember.findMany({
      where: {
        teamId,
        role: { in: [TeamRole.OWNER, TeamRole.ADMIN] },
      },
    });

    for (const admin of teamAdmins) {
      await this.notificationsService
        .createNotification(
          admin.userId,
          'New Join Request',
          `${requesterName} wants to join ${team.name}`,
          NotificationType.JOIN_REQUEST,
          '/teams',
        )
        .catch((err) => console.error('Failed to create notification:', err));
    }

    return request;
  }

  // 2. Join team directly via inviteCode or team ID (case-insensitive)
  async joinViaInviteCode(inviteCode: string, userId: string) {
    const rawCode = inviteCode.trim();
    const team = await this.prisma.team.findFirst({
      where: {
        OR: [
          { inviteCode: { equals: rawCode, mode: 'insensitive' } },
          { id: { equals: rawCode, mode: 'insensitive' } },
        ],
      },
    });

    if (!team) {
      throw new NotFoundException('Invalid invite code or team ID');
    }

    const existingMember = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: team.id } },
    });

    if (existingMember) {
      throw new ConflictException('You are already a member of this team');
    }

    // Join team as MEMBER
    const membership = await this.prisma.teamMember.create({
      data: {
        userId,
        teamId: team.id,
        role: TeamRole.MEMBER,
      },
      include: {
        team: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify team owners and admins that a new member joined via invite code
    const adminsAndOwners = await this.prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        role: { in: [TeamRole.OWNER, TeamRole.ADMIN] },
      },
    });

    const joinerName =
      membership.user.name || membership.user.email || 'A new user';

    for (const admin of adminsAndOwners) {
      await this.notificationsService
        .createNotification(
          admin.userId,
          'New Member Joined',
          `${joinerName} joined ${team.name} using an invite code`,
          NotificationType.JOIN_REQUEST,
          `/teams/${team.id}?tab=members`,
        )
        .catch((err) =>
          console.error('Failed to create invite join notification:', err),
        );
    }

    return membership;
  }

  // 3. List pending join requests for a team (Admin/Owner only)
  async getPendingRequests(teamId: string, userId: string) {
    await this.verifyAdminOrOwner(teamId, userId);

    return this.prisma.joinRequest.findMany({
      where: { teamId, status: 'PENDING' },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. Accept or Decline join request (Admin/Owner only)
  async respondToJoinRequest(
    teamId: string,
    requestId: string,
    userId: string,
    dto: UpdateJoinRequestDto,
  ) {
    await this.verifyAdminOrOwner(teamId, userId);

    const request = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || request.teamId !== teamId) {
      throw new NotFoundException('Join request not found');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    const teamName = team?.name || 'Team';

    if (dto.status === JoinRequestStatus.ACCEPTED) {
      // Create team member and update request status
      await this.prisma.$transaction([
        this.prisma.teamMember.upsert({
          where: { userId_teamId: { userId: request.userId, teamId } },
          update: { role: TeamRole.MEMBER },
          create: { userId: request.userId, teamId, role: TeamRole.MEMBER },
        }),
        this.prisma.joinRequest.update({
          where: { id: requestId },
          data: { status: JoinRequestStatus.ACCEPTED, respondedAt: new Date() },
        }),
      ]);

      await this.notificationsService
        .createNotification(
          request.userId,
          'Join Request Approved',
          `Your request to join ${teamName} was accepted!`,
          NotificationType.REQUEST_APPROVED,
          '/teams',
        )
        .catch((err) => console.error('Failed to create notification:', err));

      return { message: 'Join request accepted' };
    } else {
      await this.prisma.joinRequest.update({
        where: { id: requestId },
        data: { status: JoinRequestStatus.DECLINED, respondedAt: new Date() },
      });

      await this.notificationsService
        .createNotification(
          request.userId,
          'Join Request Declined',
          `Your request to join ${teamName} was declined.`,
          NotificationType.REQUEST_DECLINED,
          '/teams',
        )
        .catch((err) => console.error('Failed to create notification:', err));

      return { message: 'Join request declined' };
    }
  }

  // 5. Remove member from team (Admin/Owner only, cannot remove Owner)
  async removeMember(
    teamId: string,
    targetUserId: string,
    callerUserId: string,
  ) {
    const callerMembership = await this.verifyAdminOrOwner(
      teamId,
      callerUserId,
    );

    const targetMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in team');
    }

    if (targetMembership.role === TeamRole.OWNER) {
      throw new ForbiddenException('Team Owner cannot be removed');
    }

    if (
      callerMembership.role === TeamRole.ADMIN &&
      targetMembership.role === TeamRole.ADMIN
    ) {
      throw new ForbiddenException('Admins cannot remove other Admins');
    }

    await this.prisma.teamMember.delete({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    const teamName = team?.name || 'Team';

    this.sseService.pushNotification(targetUserId, {
      type: 'MEMBER_REMOVED',
      teamId,
      teamName,
    });

    return { message: 'Member removed successfully' };
  }

  // 6. Change member role (Owner only)
  async changeMemberRole(
    teamId: string,
    targetUserId: string,
    callerUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const callerMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: callerUserId, teamId } },
    });

    if (!callerMembership || callerMembership.role !== TeamRole.OWNER) {
      throw new ForbiddenException(
        'Only the team Owner can change member roles',
      );
    }

    const targetMembership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: targetUserId, teamId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in team');
    }

    if (targetMembership.role === TeamRole.OWNER) {
      throw new BadRequestException('Cannot change role of team Owner');
    }

    const updatedMember = await this.prisma.teamMember.update({
      where: { userId_teamId: { userId: targetUserId, teamId } },
      data: { role: dto.role },
    });

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    const teamName = team?.name || 'Team';

    // 1. Create a persistent notification for the updated member
    await this.notificationsService
      .createNotification(
        targetUserId,
        'Role Updated',
        `Your role in ${teamName} has been changed to ${dto.role}`,
        NotificationType.REQUEST_APPROVED,
        `/teams/${teamId}?tab=members`,
      )
      .catch((err) => console.error('Failed to create notification:', err));

    // 2. Broadcast role update to all members of the team for live UI display update
    const allMembers = await this.prisma.teamMember.findMany({
      where: { teamId },
    });

    for (const m of allMembers) {
      this.sseService.pushNotification(m.userId, {
        type: 'ROLE_UPDATED',
        teamId,
        userId: targetUserId,
        role: dto.role,
      });
    }

    return updatedMember;
  }

  private async verifyAdminOrOwner(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });

    if (
      !membership ||
      (membership.role !== TeamRole.OWNER && membership.role !== TeamRole.ADMIN)
    ) {
      throw new ForbiddenException('Admin or Owner permission required');
    }

    return membership;
  }
}
