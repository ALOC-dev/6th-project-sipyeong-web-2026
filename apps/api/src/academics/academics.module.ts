import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import { AcademicsStore } from './academics.store';

@Module({
  imports: [AuthModule],
  controllers: [AcademicsController],
  providers: [AcademicsService, AcademicsStore],
})
export class AcademicsModule {}
