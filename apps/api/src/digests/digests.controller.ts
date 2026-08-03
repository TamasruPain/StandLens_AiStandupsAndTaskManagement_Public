import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { DigestsService } from './digests.service';

@Controller('digests')
export class DigestsController {
  constructor(private readonly digestsService: DigestsService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }
    return userId;
  }

  // Trigger AI digest generation (direct generation)
  @Post('generate')
  async triggerDigestGeneration(
    @Headers() headers: Record<string, string>,
    @Body('teamId') teamId: string,
    @Body('date') date?: string,
  ) {
    const userId = this.getUserId(headers);
    return this.digestsService.triggerDigestGeneration(teamId, userId, date);
  }

  // Get digests for a specific team
  @Get()
  async getTeamDigests(
    @Query('teamId') teamId: string,
    @Query('date') date?: string,
  ) {
    return this.digestsService.getTeamDigests(teamId, date);
  }

  // Get digests grouped by team
  @Get('grouped')
  async getGroupedUserDigests() {
    return this.digestsService.getGroupedUserDigests();
  }

  @Get(':id')
  async getDigestById(@Param('id') digestId: string) {
    return this.digestsService.getDigestById(digestId);
  }
}
