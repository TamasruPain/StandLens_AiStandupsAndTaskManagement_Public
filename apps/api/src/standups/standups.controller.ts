import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { StandupsService } from './standups.service';
import { SubmitStandupDto } from './dto/standup.dto';

@Controller('standups')
export class StandupsController {
  constructor(private readonly standupsService: StandupsService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }
    return userId;
  }

  // Submit or update daily standup
  @Post()
  async submitStandup(
    @Headers() headers: Record<string, string>,
    @Body() dto: SubmitStandupDto,
  ) {
    const userId = this.getUserId(headers);
    return this.standupsService.submitStandup(userId, dto);
  }

  // Get team standups for a specific date
  @Get()
  async getTeamStandups(
    @Headers() headers: Record<string, string>,
    @Query('teamId') teamId: string,
    @Query('date') date?: string,
  ) {
    const userId = this.getUserId(headers);
    return this.standupsService.getTeamStandups(teamId, userId, date);
  }

  // Get personal standup history
  @Get('me')
  async getMyStandupHistory(
    @Headers() headers: Record<string, string>,
    @Query('teamId') teamId?: string,
  ) {
    const userId = this.getUserId(headers);
    return this.standupsService.getMyStandupHistory(userId, teamId);
  }
}
