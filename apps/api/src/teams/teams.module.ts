import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { MembershipService } from '../membership/membership.service';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, MembershipService],
  exports: [TeamsService],
})
export class TeamsModule {}
