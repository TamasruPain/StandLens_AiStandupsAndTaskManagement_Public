import { Module } from '@nestjs/common';
import { DigestsController } from './digests.controller';
import { DigestsService } from './digests.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [DigestsController],
  providers: [DigestsService],
  exports: [DigestsService],
})
export class DigestsModule {}
