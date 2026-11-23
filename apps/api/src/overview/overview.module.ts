import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { OverviewStore } from './overview.store';

@Module({
  imports: [AuthModule],
  controllers: [OverviewController],
  providers: [OverviewService, OverviewStore],
})
export class OverviewModule {}
