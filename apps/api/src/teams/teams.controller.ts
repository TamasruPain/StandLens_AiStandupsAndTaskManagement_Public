import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { MembershipService } from '../membership/membership.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly membershipService: MembershipService,
  ) {}

  // Helper to get current authenticated userId from header
  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException(
        'x-user-id header is required for authentication',
      );
    }
    return userId;
  }

  @Post()
  async createTeam(
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateTeamDto,
  ) {
    const userId = this.getUserId(headers);
    return this.teamsService.createTeam(userId, dto);
  }

  @Post('join/:inviteCode')
  async joinViaInviteCode(
    @Headers() headers: Record<string, string>,
    @Param('inviteCode') inviteCode: string,
  ) {
    const userId = this.getUserId(headers);
    return this.membershipService.joinViaInviteCode(inviteCode, userId);
  }

  @Get()
  async getUserTeams(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.teamsService.getUserTeams(userId);
  }

  @Get('search')
  async searchTeams(
    @Headers() headers: Record<string, string>,
    @Query('q') query: string,
  ) {
    const userId = this.getUserId(headers);
    return this.teamsService.searchTeams(query, userId);
  }

  @Get(':id')
  async getTeamDetails(
    @Headers() headers: Record<string, string>,
    @Param('id') teamId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.teamsService.getTeamDetails(teamId, userId);
  }

  @Patch(':id')
  async updateTeam(
    @Headers() headers: Record<string, string>,
    @Param('id') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    const userId = this.getUserId(headers);
    return this.teamsService.updateTeam(teamId, userId, dto);
  }

  @Delete(':id')
  async deleteTeam(@Param('id') teamId: string) {
    return this.teamsService.deleteTeam(teamId);
  }
}
