import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import {
  UpdateJoinRequestDto,
  UpdateMemberRoleDto,
} from './dto/membership.dto';

@Controller('teams')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }
    return userId;
  }

  // Request to join a team
  @Post(':teamId/join-request')
  async sendJoinRequest(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.sendJoinRequest(teamId, userId);
  }

  // Join via invite code
  @Post('join/:inviteCode')
  async joinViaInviteCode(
    @Headers() headers: Record<string, string>,
    @Param('inviteCode') inviteCode: string,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.joinViaInviteCode(inviteCode, userId);
  }

  // List pending join requests
  @Get(':teamId/join-requests')
  async getPendingRequests(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.getPendingRequests(teamId, userId);
  }

  // Accept or decline join request
  @Patch(':teamId/join-requests/:requestId')
  async respondToJoinRequest(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
    @Param('requestId') requestId: string,
    @Body() dto: UpdateJoinRequestDto,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.respondToJoinRequest(
      teamId,
      requestId,
      userId,
      dto,
    );
  }

  // Remove member
  @Delete(':teamId/members/:memberUserId')
  async removeMember(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.removeMember(teamId, memberUserId, userId);
  }

  // Change member role
  @Patch(':teamId/members/:memberUserId/role')
  async changeMemberRole(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.changeMemberRole(
      teamId,
      memberUserId,
      userId,
      dto,
    );
  }
}
